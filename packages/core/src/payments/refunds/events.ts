import { and, asc, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { payment, paymentEvent, paymentRefund, type ShopperDatabase } from "@shopper/db-pg";
import { fromPesewas } from "@shopper/money";
import { changeRefund, refundView } from "./commands";

type Applied = { duplicate: true } | ({ duplicate: false } & ReturnType<typeof refundView>);
type RefundEvent = {
  key: string;
  kind: "refund.processed" | "refund.failed";
  reference: string;
  id: string;
};

/**
 * The open refund a `refund.*` webhook speaks of: the one Paystack gave this id, else the only open refund of that
 * charge and amount still without an id. An id that names a settled refund, or another refund's id, matches none;
 * so do two open refunds of one amount, which the workflow's verify settles.
 */
export async function findOpenRefund(
  db: ShopperDatabase,
  input: { reference: string; pesewas: number; providerId?: string },
) {
  const rows = await db
    .select({
      id: paymentRefund.id,
      orgId: paymentRefund.orgId,
      providerReference: paymentRefund.providerReference,
      status: paymentRefund.status,
    })
    .from(paymentRefund)
    .innerJoin(
      payment,
      and(eq(payment.orgId, paymentRefund.orgId), eq(payment.id, paymentRefund.paymentId)),
    )
    .where(
      and(
        eq(payment.reference, input.reference),
        eq(paymentRefund.amount, fromPesewas(input.pesewas)),
      ),
    )
    .orderBy(asc(paymentRefund.id));
  const open = (row: (typeof rows)[number]) => row.status === "pending" || row.status === "failed";
  const exact = input.providerId && rows.find((row) => row.providerReference === input.providerId);
  if (exact) return open(exact) ? exact : undefined;
  // A webhook carrying an id only falls back to a refund Paystack has not yet given one.
  const candidates = rows.filter(
    (row) => open(row) && (!input.providerId || !row.providerReference),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Applies a Paystack `refund.*` webhook and its outcome in one transaction; a replay returns `duplicate`. */
export const applyRefundEvent = defineCommand({
  name: "payment.refund.webhook",
  async replay(tx, context, input: RefundEvent): Promise<{ output: Applied } | undefined> {
    const [seen] = await tx
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.orgId, context.orgId),
          eq(paymentEvent.provider, "paystack"),
          eq(paymentEvent.key, input.key),
        ),
      );
    return seen ? { output: { duplicate: true } } : undefined;
  },
  async run(tx, context, input: RefundEvent): Promise<Applied> {
    await tx.insert(paymentEvent).values({
      orgId: context.orgId,
      provider: "paystack",
      key: input.key,
      reference: input.reference,
      kind: input.kind,
    });
    return {
      duplicate: false as const,
      ...(await changeRefund(tx, context, {
        id: input.id,
        status: input.kind === "refund.processed" ? "processed" : "failed",
        reason:
          input.kind === "refund.failed" ? "Paystack could not refund this payment" : undefined,
      })),
    };
  },
  audit: (input) => ({ id: input.id, reference: input.reference, kind: input.kind }),
});
