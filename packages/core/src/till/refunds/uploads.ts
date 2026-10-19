import { eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import { refund } from "@shopper/db-sqlite";

type Mark = { id: string };
const entity = (input: Mark) => ({ entity: "refund", entityId: input.id });

/** The server recorded the refund; `result` is what it answered. */
export const markRefundAccepted = defineCommand({
  name: "refund.accept",
  async run(tx, _context, input: Mark & { result: Record<string, unknown>; at: Date }) {
    await tx
      .update(refund)
      .set({ acceptedAt: input.at.toISOString(), result: input.result, nextAttemptAt: null })
      .where(eq(refund.id, input.id));
  },
  audit: (input) => ({ refundId: input.id }),
  details: entity,
});

/** Terminal: the server refused the refund; it stays listed with the reason and is never retried. */
export const markRefundRejected = defineCommand({
  name: "refund.reject",
  async run(tx, _context, input: Mark & { code: string; reason: string }) {
    await tx
      .update(refund)
      .set({ blockedCode: input.code, blockedReason: input.reason, nextAttemptAt: null })
      .where(eq(refund.id, input.id));
  },
  audit: (input) => ({ refundId: input.id, code: input.code, reason: input.reason }),
  details: entity,
});

/** Counts a failed attempt and defers the next one to `nextAttemptAt` (epoch ms). */
export const markRefundFailed = defineCommand({
  name: "refund.upload.failed",
  async run(tx, _context, input: Mark & { nextAttemptAt: number; reason: string }) {
    await tx
      .update(refund)
      .set({ attempts: sql`${refund.attempts} + 1`, nextAttemptAt: input.nextAttemptAt })
      .where(eq(refund.id, input.id));
  },
  audit: (input) => ({ refundId: input.id, reason: input.reason }),
  details: entity,
});
