import * as v from "valibot";
import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import { markReceiptUploaded, markReceiptUploadFailed } from "@shopper/core/till";
import { localSale, receiptOutput } from "@shopper/db-sqlite";
import { createPushTransport } from "../push/http";
import { retryDeadline } from "../push/backoff";
import { receiptGrant } from "../schemas/uploads/receipts";
import type { ReceiptUploadOptions } from "./types";

/** Attempt count that yields the push backoff ceiling. */
const MAX_BACKOFF_ATTEMPTS = 16;
class PermanentError extends Error {}

/**
 * Uploads each acknowledged sale's receipt PDF straight to object storage: ask the server for a grant,
 * PUT the bytes, then confirm. There is no timer; callers trigger it on start, on acknowledgement,
 * after a PDF is stored and on Sync now. A failure is counted and stamps the PDF's `next_upload_at`
 * with the push backoff (growing with its attempts); triggers skip it until then, except a forced one.
 */
export function createReceiptUploadWorker(options: ReceiptUploadOptions) {
  const { database, config } = options;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const transport = createPushTransport(options);
  const context = { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion };
  let running: Promise<void> | undefined;
  let rerun = false;
  let forced = false;
  let stopped = false;

  /** Sales whose PDF still needs uploading: acknowledged, stored, not uploaded and (unless forced) past its backoff. */
  const pending = (force: boolean) =>
    database.read(async (tx) =>
      (
        await tx
          .select({ saleId: receiptOutput.saleId })
          .from(receiptOutput)
          .innerJoin(
            localSale,
            and(eq(localSale.orgId, receiptOutput.orgId), eq(localSale.id, receiptOutput.saleId)),
          )
          .where(
            and(
              eq(receiptOutput.orgId, config.orgId),
              eq(localSale.deviceId, config.deviceId),
              isNotNull(localSale.storeSequence),
              isNotNull(receiptOutput.pdf),
              isNull(receiptOutput.uploadedAt),
              force
                ? undefined
                : or(isNull(receiptOutput.nextUploadAt), lte(receiptOutput.nextUploadAt, now())),
            ),
          )
      ).map((row) => row.saleId),
    );

  /** One PDF at a time, so a backlog never sits in memory. */
  const load = (saleId: string) =>
    database.read(
      async (tx) =>
        (
          await tx
            .select({
              pdf: receiptOutput.pdf,
              size: receiptOutput.pdfSize,
              sha256: receiptOutput.pdfSha256,
              attempts: receiptOutput.uploadAttempts,
            })
            .from(receiptOutput)
            .where(eq(receiptOutput.saleId, saleId))
        )[0],
    );

  async function upload(saleId: string, row: NonNullable<Awaited<ReturnType<typeof load>>>) {
    const { response, raw } = await transport.request("/sync/receipts", {
      saleId,
      size: row.size,
      sha256: row.sha256,
    });
    if (!response.ok) {
      const message = `Receipt grant refused (${response.status})`;
      // An unknown sale or an oversized PDF will not fix itself: wait the longest backoff.
      throw response.status === 404 || response.status === 413
        ? new PermanentError(message)
        : new Error(message);
    }
    const issued = v.parse(receiptGrant, JSON.parse(raw));
    // A linked receipt is already on the server (a crash between confirm and the local mark): only record it.
    if (issued.url) {
      const put = await fetch(issued.url, {
        method: "PUT",
        headers: issued.headers,
        body: new Uint8Array(row.pdf!),
      });
      if (!put.ok) throw new Error(`Receipt upload refused (${put.status})`);
      const confirmed = await transport.request(`/sync/receipts/${issued.assetId}/confirm`, {});
      if (!confirmed.response.ok)
        throw new Error(`Receipt confirmation refused (${confirmed.response.status})`);
    }
    await markReceiptUploaded(database, context, {
      saleId,
      assetId: issued.assetId,
      at: new Date(now()),
    });
  }

  async function run(force: boolean) {
    for (const saleId of await pending(force)) {
      if (stopped) return;
      const row = await load(saleId);
      if (!row?.pdf) continue;
      try {
        await upload(saleId, row);
      } catch (error) {
        if (stopped) return;
        await markReceiptUploadFailed(database, context, {
          saleId,
          nextUploadAt: retryDeadline(
            now(),
            error instanceof PermanentError ? MAX_BACKOFF_ATTEMPTS : row.attempts,
            random(),
          ),
          reason: error instanceof Error ? error.message : "Upload failed",
        });
      }
      options.onChange?.();
    }
  }

  /** `force` (Sync now) ignores each PDF's backoff deadline. */
  function trigger(force = false): Promise<void> {
    if (stopped) return Promise.resolve();
    forced ||= force;
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      do {
        rerun = false;
        const ignoreBackoff = forced;
        forced = false;
        await run(ignoreBackoff);
      } while (rerun && !stopped);
    })()
      .catch((error) => console.error("Receipt upload failed", error))
      .finally(() => {
        running = undefined;
      });
    return running;
  }

  return {
    trigger,
    async stop() {
      stopped = true;
      transport.abort();
      await running;
    },
  };
}
