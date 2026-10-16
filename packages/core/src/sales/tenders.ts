import { and, eq } from "drizzle-orm";
import { payment, saleTender, type ShopperTransaction } from "@shopper/db-pg";
import { add, money, sub } from "@shopper/money";
import type { SaleSnapshot } from "../schemas/till/sale";
import { settle } from "../till/tenders/settle";
import { TillError } from "../till/error";
import { SaleError } from "./error";

export async function validateTenders(tx: ShopperTransaction, snapshot: SaleSnapshot) {
  let settlement: ReturnType<typeof settle>;
  try {
    settlement = settle(
      snapshot.totals.gross,
      snapshot.tenders,
      snapshot.cashRounding === 0 ? "none" : "10p",
    );
  } catch (error) {
    if (!(error instanceof TillError)) throw error;
    throw new SaleError("INVALID_TOTALS", error.message);
  }
  const paid = snapshot.tenders.reduce((sum, tender) => add(sum, tender.amount), money(0));
  if (
    settlement.balance !== 0 ||
    settlement.roundingLine !== snapshot.cashRounding ||
    settlement.total !== snapshot.total ||
    settlement.change !== snapshot.change ||
    paid !== snapshot.paid ||
    sub(paid, snapshot.change) !== snapshot.total
  )
    throw new SaleError("INVALID_TOTALS", "Sale tenders do not reconcile");
  const ids = new Set<string>();
  const references = new Set<string>();
  const rows = [];
  for (const [position, tender] of snapshot.tenders.entries()) {
    if (tender.amount === 0 && snapshot.total !== 0)
      throw new SaleError("INVALID_TOTALS", "Zero tender requires a zero-total sale");
    if (ids.has(tender.id)) throw new SaleError("INVALID_EVENT", "Duplicate tender identity");
    ids.add(tender.id);
    let paymentId: string | null = null;
    if (tender.kind === "momo") {
      if (!tender.reference || references.has(tender.reference))
        throw new SaleError("INVALID_PAYMENT", "MoMo reference must be unique");
      references.add(tender.reference);
      // Lock the payment through insert so concurrent uploads cannot consume it twice.
      const [confirmed] = await tx
        .select()
        .from(payment)
        .where(
          and(
            eq(payment.orgId, snapshot.orgId),
            eq(payment.reference, tender.reference),
            eq(payment.branchId, snapshot.branchId),
            eq(payment.deviceId, snapshot.deviceId),
            eq(payment.cashierId, snapshot.cashierId),
            eq(payment.status, "confirmed"),
            eq(payment.amount, tender.amount),
          ),
        )
        .for("update");
      if (!confirmed)
        throw new SaleError(
          "INVALID_PAYMENT",
          "MoMo payment is not confirmed for this register and amount",
        );
      const [used] = await tx
        .select({ id: saleTender.id })
        .from(saleTender)
        .where(and(eq(saleTender.orgId, snapshot.orgId), eq(saleTender.paymentId, confirmed.id)));
      if (used) throw new SaleError("INVALID_PAYMENT", "MoMo payment already settled another sale");
      paymentId = confirmed.id;
    }
    rows.push({ ...tender, orgId: snapshot.orgId, saleId: snapshot.id, position, paymentId });
  }
  return rows;
}
