// What a test reads back about one order from the tables: the order, its attempts and refunds, its fiscal documents,
// stock holds and movements, and the books entry it posted.
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import type { Delivery, Envelope } from "@shopper/ports";

export function orderReads(db: schema.ShopperDatabase) {
  const row = async (order: { id: string }) =>
    (await db.select().from(schema.onlineOrder).where(eq(schema.onlineOrder.id, order.id)))[0]!;
  const payments = (order: { id: string }) =>
    db.select().from(schema.orderPayment).where(eq(schema.orderPayment.orderId, order.id));
  const refunds = (order: { id: string }) =>
    db
      .select({ refund: schema.orderRefund })
      .from(schema.orderRefund)
      .innerJoin(
        schema.orderPayment,
        and(
          eq(schema.orderPayment.orgId, schema.orderRefund.orgId),
          eq(schema.orderPayment.id, schema.orderRefund.orderPaymentId),
        ),
      )
      .where(eq(schema.orderPayment.orderId, order.id))
      .then((rows) => rows.map((found) => found.refund));
  const fiscal = (order: { id: string }) =>
    db.select().from(schema.fiscalDoc).where(eq(schema.fiscalDoc.orderId, order.id));
  const holds = (order: { id: string }) =>
    db.select().from(schema.stockHold).where(eq(schema.stockHold.orderId, order.id));
  const movements = (order: { id: string }) =>
    db.select().from(schema.stockMovement).where(eq(schema.stockMovement.orderId, order.id));
  const journal = async (source: "order" | "reversal", sourceId: string) => {
    const [entry] = await db
      .select()
      .from(schema.journalEntry)
      .where(
        and(eq(schema.journalEntry.source, source), eq(schema.journalEntry.sourceId, sourceId)),
      );
    if (!entry) return undefined;
    const lines = await db
      .select({ amount: schema.journalLine.amount, name: schema.ledgerAccount.systemKey })
      .from(schema.journalLine)
      .innerJoin(
        schema.ledgerAccount,
        and(
          eq(schema.ledgerAccount.orgId, schema.journalLine.orgId),
          eq(schema.ledgerAccount.id, schema.journalLine.accountId),
        ),
      )
      .where(eq(schema.journalLine.entryId, entry.id));
    return {
      entry,
      lines: Object.fromEntries(lines.map((line) => [line.name, line.amount])) as Record<
        string,
        number
      >,
    };
  };

  return { row, payments, refunds, fiscal, holds, movements, journal };
}

/** A queue delivery that counts how it was answered. */
export function deliveryOf(message: Envelope) {
  const answers = { ack: 0, retry: 0 };
  const delivery: Delivery = {
    message,
    attempts: 1,
    ack: async () => void answers.ack++,
    retry: async () => void answers.retry++,
  };
  return { delivery, answers };
}
