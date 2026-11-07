import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { orderPayment, orderRefund, type ShopperTransaction } from "@shopper/db-pg";

/** The payment that kept the order: confirmed, and not already owed back whole (a late or duplicate payment is). */
export async function keeperPayment(tx: ShopperTransaction, orgId: string, orderId: string) {
  const [found] = await tx
    .select({ payment: orderPayment })
    .from(orderPayment)
    .leftJoin(
      orderRefund,
      and(
        eq(orderRefund.orgId, orderPayment.orgId),
        eq(orderRefund.orderPaymentId, orderPayment.id),
        inArray(orderRefund.reason, ["late_payment", "duplicate_payment"]),
      ),
    )
    .where(
      and(
        eq(orderPayment.orgId, orgId),
        eq(orderPayment.orderId, orderId),
        eq(orderPayment.status, "confirmed"),
        isNull(orderRefund.id),
      ),
    )
    .orderBy(asc(orderPayment.confirmedAt))
    .limit(1);
  return found!.payment;
}
