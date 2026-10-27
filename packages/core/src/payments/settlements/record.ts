import { and, eq, inArray, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { add, money } from "@shopper/money";
import { payment, settlement, settlementLine } from "@shopper/db-pg";
import type { PaystackSettlement } from "../paystack/types";

/** The daily settlement workflow's business key; a refresh adds a suffix so it runs again. */
export const settlementId = (orgId: string, day: string) => `settlement-${orgId}-${day}`;

/**
 * Stores the Paystack payouts that concern this org: only lines whose reference is one of its Paystack payments
 * (one platform account settles every org). Each line is flagged `amount_mismatch` when Paystack settled a
 * different amount than the payment confirmed. Recording the same payout again adds nothing.
 */
export const recordSettlements = defineCommand({
  name: "payment.settlement.recorded",
  async run(tx, context, input: { day: string; payouts: PaystackSettlement[] }) {
    const references = input.payouts.flatMap((payout) =>
      payout.lines.map((line) => line.reference),
    );
    const known = references.length
      ? await tx
          .select({ id: payment.id, reference: payment.reference, amount: payment.amount })
          .from(payment)
          .where(
            and(
              eq(payment.orgId, context.orgId),
              eq(payment.provider, "paystack"),
              inArray(payment.reference, references),
            ),
          )
      : [];
    const byReference = new Map(known.map((row) => [row.reference, row]));
    const recorded = await Promise.all(
      input.payouts.map(async (payout) => {
        const lines = payout.lines.flatMap((line) => {
          const paid = byReference.get(line.reference);
          return paid ? [{ ...line, paid }] : [];
        });
        if (!lines.length) return { lines: 0, mismatches: 0 };
        const [row] = await tx
          .insert(settlement)
          .values({
            orgId: context.orgId,
            provider: "paystack",
            providerId: payout.providerId,
            settledOn: payout.settledOn,
            amount: lines.reduce((sum, line) => add(sum, line.amount), money(0)),
            fees: lines.reduce((sum, line) => add(sum, line.fee), money(0)),
          })
          .onConflictDoUpdate({
            target: [settlement.orgId, settlement.provider, settlement.providerId],
            set: {
              settledOn: sql`excluded.settled_on`,
              amount: sql`excluded.amount`,
              fees: sql`excluded.fees`,
            },
          })
          .returning({ id: settlement.id });
        const inserted = await tx
          .insert(settlementLine)
          .values(
            lines.map((line) => ({
              orgId: context.orgId,
              settlementId: row!.id,
              paymentId: line.paid.id,
              amount: line.amount,
              fee: line.fee,
              flag:
                line.amount === line.paid.amount ? ("ok" as const) : ("amount_mismatch" as const),
            })),
          )
          .onConflictDoNothing()
          .returning({ flag: settlementLine.flag });
        return {
          lines: inserted.length,
          mismatches: inserted.filter((line) => line.flag === "amount_mismatch").length,
        };
      }),
    );
    const unknown = references.length - known.length;
    if (unknown) console.info({ event: "settlement.lines_skipped", orgId: context.orgId, unknown });
    return {
      day: input.day,
      lines: recorded.reduce((sum, r) => sum + r.lines, 0),
      mismatches: recorded.reduce((sum, r) => sum + r.mismatches, 0),
    };
  },
  // The input holds every org's payouts; only this org's summary is audited.
  audit: (_input, result) => result,
});

/** Marks an org-day's settlement fetch failed once its retries are spent, so the run is not mistaken for never started. */
export const failSettlement = defineCommand({
  name: "payment.settlement.failed",
  run: async (_tx, _context, input: { day: string; reason: string }) => input,
  audit: (input) => input,
});
