import * as v from "valibot";
import { and, asc, eq, gt } from "drizzle-orm";
import { v7 } from "uuid";
import { tillAudit, tillState } from "@shopper/db-sqlite";
import { createPushTransport } from "../push/http";
import { auditOutcome } from "../schemas/uploads/audit";
import type { ReceiptUploadOptions } from "./types";

/**
 * Uploads this till's audit chain after the server's head, `batch` rows a request, until the server holds it all.
 * The head is plain sync state, not an audited command: auditing it would append to the chain being uploaded, so
 * the upload would never finish. A refusal is kept and stops uploads for good; any other failure ends the run and
 * the next trigger (start, acknowledgement, Sync now) tries again.
 */
export function createAuditUploadWorker(options: ReceiptUploadOptions & { batch?: number }) {
  const { database, config } = options;
  const batch = options.batch ?? 100;
  const transport = createPushTransport(options);
  const mine = and(eq(tillState.orgId, config.orgId), eq(tillState.deviceId, config.deviceId));
  let running: Promise<void> | undefined;
  let rerun = false;
  let stopped = false;

  const save = (values: Partial<typeof tillState.$inferInsert>) =>
    database.transaction((tx) => tx.update(tillState).set(values).where(mine));

  async function run() {
    for (;;) {
      const { state, rows } = await database.read(async (tx) => {
        const [state] = await tx.select().from(tillState).where(mine);
        const rows = await tx
          .select()
          .from(tillAudit)
          .where(
            and(
              eq(tillAudit.orgId, config.orgId),
              gt(tillAudit.chainSeq, state?.auditUploadedSeq ?? 0),
            ),
          )
          .orderBy(asc(tillAudit.chainSeq))
          .limit(batch);
        return { state, rows };
      });
      if (stopped || !state || state.auditBlockedCode || !rows.length) return;
      const { response, raw } = await transport.request("/sync/audit", {
        requestId: v7(),
        entries: rows,
      });
      if (!response.ok) throw new Error(`Audit upload refused (${response.status})`);
      const outcome = v.parse(auditOutcome, JSON.parse(raw));
      if (outcome.rejected) {
        await save({
          auditBlockedCode: outcome.rejected.code,
          auditBlockedReason: outcome.rejected.message,
        });
        options.onChange?.();
        return;
      }
      if (!outcome.accepted) throw new Error("Audit upload answered with neither head nor refusal");
      // A head that does not move means the server cannot take these rows; stop rather than loop.
      if (outcome.accepted.head.seq === state.auditUploadedSeq) return;
      await save({ auditUploadedSeq: outcome.accepted.head.seq });
    }
  }

  function trigger(_force = false): Promise<void> {
    if (stopped) return Promise.resolve();
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      do {
        rerun = false;
        await run();
      } while (rerun && !stopped);
    })()
      .catch((error) => console.error("Audit upload failed", error))
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
