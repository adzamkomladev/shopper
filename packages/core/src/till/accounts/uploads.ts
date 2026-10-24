import { eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import { accountPayment } from "@shopper/db-sqlite";

type Mark = { id: string };
const entity = (input: Mark) => ({ entity: "account_payment", entityId: input.id });

/** The server applied the payment (or had it already). */
export const markAccountPaymentAccepted = defineCommand({
  name: "account.payment.upload.accept",
  async run(tx, _context, input: Mark & { result: Record<string, unknown>; at: Date }) {
    await tx
      .update(accountPayment)
      .set({ acceptedAt: input.at.toISOString(), result: input.result, nextAttemptAt: null })
      .where(eq(accountPayment.id, input.id));
  },
  audit: (input) => ({ uploadId: input.id }),
  details: entity,
});

/** Terminal: the server refused it; it stays with the reason and is never retried. */
export const markAccountPaymentRejected = defineCommand({
  name: "account.payment.upload.reject",
  async run(tx, _context, input: Mark & { code: string; reason: string }) {
    await tx
      .update(accountPayment)
      .set({ blockedCode: input.code, blockedReason: input.reason, nextAttemptAt: null })
      .where(eq(accountPayment.id, input.id));
  },
  audit: (input) => ({ uploadId: input.id, code: input.code, reason: input.reason }),
  details: entity,
});

/** Counts a failed attempt and defers the next one to `nextAttemptAt` (epoch ms). */
export const markAccountPaymentFailed = defineCommand({
  name: "account.payment.upload.failed",
  async run(tx, _context, input: Mark & { nextAttemptAt: number; reason: string }) {
    await tx
      .update(accountPayment)
      .set({ attempts: sql`${accountPayment.attempts} + 1`, nextAttemptAt: input.nextAttemptAt })
      .where(eq(accountPayment.id, input.id));
  },
  audit: (input) => ({ uploadId: input.id, reason: input.reason }),
  details: entity,
});
