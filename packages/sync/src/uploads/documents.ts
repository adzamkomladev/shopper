import * as v from "valibot";
import { and, count, eq } from "drizzle-orm";
import { outbox } from "@shopper/db-sqlite";
import { createPushTransport } from "../push/http";
import { retryDeadline } from "../push/backoff";
import { documentOutcome } from "../schemas/uploads/documents";
import type { DocumentUpload, ReceiptUploadOptions, Row } from "./types";

/**
 * Uploads queued documents, oldest first, and only while this device has no unacknowledged sale: a document
 * is a delta on top of its sales, so they must reach the server first. Like the receipt worker it has no timer;
 * callers trigger it on start, on acknowledgement, after queueing and on Sync now. A rejection is terminal
 * (kept with its reason); any other failure is counted and backed off, and stops the run so documents never
 * overtake each other.
 */
export function createDocumentUploadWorker<T extends Row>(
  options: ReceiptUploadOptions,
  upload: DocumentUpload<T>,
) {
  const { database, config } = options;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const transport = createPushTransport(options);
  const context = { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion };
  let running: Promise<void> | undefined;
  let rerun = false;
  let forced = false;
  let stopped = false;

  const pending = (force: boolean) =>
    database.read(async (tx) => {
      const [{ unsent }] = await tx
        .select({ unsent: count() })
        .from(outbox)
        .where(and(eq(outbox.orgId, config.orgId), eq(outbox.deviceId, config.deviceId)));
      return unsent ? [] : upload.pending(tx, force, now());
    });

  async function run(force: boolean) {
    for (const { row, proof } of await pending(force)) {
      if (stopped) return;
      try {
        const { response, raw } = await transport.request(upload.path, upload.body(row, proof));
        if (!response.ok) {
          const retryAfter = response.headers.get("retry-after");
          throw Object.assign(new Error(`${upload.label} upload refused (${response.status})`), {
            retryAfter,
          });
        }
        const outcome = v.parse(documentOutcome, JSON.parse(raw));
        if (outcome.rejected)
          await upload.reject(database, context, {
            id: row.id,
            code: outcome.rejected.code,
            reason: outcome.rejected.message,
          });
        else if (outcome.accepted)
          await upload.accept(database, context, {
            id: row.id,
            result: outcome.accepted,
            at: new Date(now()),
          });
        else
          throw new Error(`${upload.label} upload answered with neither acceptance nor rejection`);
        options.onChange?.();
      } catch (error) {
        if (stopped) return;
        await upload.fail(database, context, {
          id: row.id,
          nextAttemptAt: retryDeadline(
            now(),
            row.attempts,
            random(),
            (error as { retryAfter?: string | null }).retryAfter,
          ),
          reason: error instanceof Error ? error.message : "Upload failed",
        });
        options.onChange?.();
        return;
      }
    }
  }

  /** `force` (Sync now) ignores each document's backoff deadline. */
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
      .catch((error) => console.error(`${upload.label} upload failed`, error))
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
