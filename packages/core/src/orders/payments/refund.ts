import * as v from "valibot";
import { and, asc, eq, isNull } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  onlineOrder,
  onlineOrderLine,
  orderPayment,
  orderRefund,
  paymentEvent,
  stockMovement,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import { PaystackError } from "../../payments/paystack/errors";
import { recordFiscalDoc } from "../../fiscal/documents";
import { reverseOrder } from "../../ledger/orders";
import { accraClock } from "../../receipts/build";
import { receiptDocument } from "../../schemas/receipts/document";
import type { OrderRefundDeps } from "../types";
import { owe } from "./apply";

type Order = typeof onlineOrder.$inferSelect;

/**
 * Compensates a paid order the shop will not fill: the order is refunded, the goods go back on the shelf, the books
 * and the invoice are reversed (a credit note for the fiscal lane), and the payer's money is queued to go back.
 * Answers false when the order was no longer paid (a replayed step).
 */
export const refundPaidOrder = defineCommand({
  name: "order.refund",
  async run(tx, ctx, input: { id: string; reason: "not_accepted" | "cancelled"; now?: Date }) {
    const now = input.now ?? new Date();
    const [order] = await tx
      .update(onlineOrder)
      .set({ status: "refunded", updatedAt: now })
      .where(
        and(
          eq(onlineOrder.orgId, ctx.orgId),
          eq(onlineOrder.id, input.id),
          eq(onlineOrder.status, "paid"),
        ),
      )
      .returning();
    if (!order) return { refunded: false as const, id: null };
    // The payment that kept the order: confirmed, and not already owed back (a duplicate payment is).
    const [payment] = await tx
      .select({ payment: orderPayment })
      .from(orderPayment)
      .leftJoin(
        orderRefund,
        and(
          eq(orderRefund.orgId, orderPayment.orgId),
          eq(orderRefund.orderPaymentId, orderPayment.id),
        ),
      )
      .where(
        and(
          eq(orderPayment.orgId, ctx.orgId),
          eq(orderPayment.orderId, order.id),
          eq(orderPayment.status, "confirmed"),
          isNull(orderRefund.id),
        ),
      )
      .orderBy(asc(orderPayment.confirmedAt))
      .limit(1);
    const refund = (await owe(tx, ctx, payment!.payment, input.reason))!;
    await giveBack(tx, ctx, order, refund.id, now);
    return { refunded: true as const, id: refund.id };
  },
  audit: (input, output) => ({ id: input.id, reason: input.reason, refunded: output.refunded }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

async function giveBack(
  tx: ShopperTransaction,
  ctx: CommandContext,
  order: Order,
  refundId: string,
  now: Date,
) {
  const lines = await tx
    .select()
    .from(onlineOrderLine)
    .where(and(eq(onlineOrderLine.orgId, ctx.orgId), eq(onlineOrderLine.orderId, order.id)))
    .orderBy(asc(onlineOrderLine.position));
  const goods = lines.flatMap((line) =>
    line.productId ? [{ ...line, productId: line.productId }] : [],
  );
  await tx.insert(stockMovement).values(
    goods.map((line) => ({
      orgId: ctx.orgId,
      branchId: order.branchId,
      productId: line.productId,
      orderId: order.id,
      reason: "return" as const,
      quantityThousandths: line.quantityThousandths,
      occurredAt: now,
    })),
  );
  await reverseOrder(tx, ctx, order, refundId, now);
  const receipt = v.parse(receiptDocument, order.receipt);
  await recordFiscalDoc(
    tx,
    ctx.orgId,
    {
      ...receipt,
      kind: "refund",
      refundOf: receipt.header.receiptNumber,
      header: {
        ...receipt.header,
        receiptNumber: `${receipt.header.receiptNumber}-C`,
        utcTime: now.toISOString(),
        accraTime: accraClock(now),
      },
      paid: money(0),
      change: money(0),
      fiscal: null,
    },
    { storeId: order.storeId, branchId: order.branchId, orderRefundId: refundId },
  );
}

/**
 * Sends one owed refund back to the payer, once. Paystack refunds are requested here and settled by their webhook;
 * Hubtel has no refund API in our client, so its refunds wait as `refund_due` for the store to send by hand. A
 * refused request is final; an interrupted one stays pending for someone to check, never repeated.
 */
export async function refundOrderPayment(deps: OrderRefundDeps, id: string, orgId: string) {
  const row = await deps.withDatabase(async (db) => {
    const [found] = await db
      .select({ refund: orderRefund, payment: orderPayment })
      .from(orderRefund)
      .innerJoin(
        orderPayment,
        and(
          eq(orderPayment.orgId, orderRefund.orgId),
          eq(orderPayment.id, orderRefund.orderPaymentId),
        ),
      )
      .where(and(eq(orderRefund.orgId, orgId), eq(orderRefund.id, id)));
    return found;
  });
  if (!row || row.refund.status !== "pending") return;
  const context = { orgId, appVersion: deps.appVersion };
  if (row.payment.provider === "hubtel" || !deps.paystack)
    return void (await deps.withDatabase((db) =>
      recordRefund(db, context, {
        id,
        from: "pending",
        status: "refund_due",
        reason: "Send this refund from your Hubtel dashboard.",
      }),
    ));
  // Claimed before Paystack is asked, so a redelivery or a concurrent consumer can never ask twice.
  const claimed = await deps.withDatabase((db) =>
    recordRefund(db, context, { id, from: "pending", status: "requested" }),
  );
  if (!claimed.changed) return;
  const result = await deps.paystack
    .refund({ reference: row.payment.id, amount: row.refund.amount })
    .then((sent) => ({
      status: sent.status === "pending" ? ("requested" as const) : sent.status,
      providerReference: sent.providerReference,
      reason: undefined,
    }))
    .catch((error: unknown) =>
      error instanceof PaystackError && error.httpStatus < 500
        ? { status: "failed" as const, reason: error.message, providerReference: undefined }
        : {
            status: "requested" as const,
            reason: "The refund request did not complete. Check Paystack before refunding again.",
            providerReference: undefined,
          },
    );
  await deps.withDatabase((db) => recordRefund(db, context, { id, from: "requested", ...result }));
}

const recordRefund = defineCommand({
  name: "order.refund.recorded",
  async run(
    tx,
    ctx,
    input: {
      id: string;
      /** The status it must still have: a second writer finds it moved and changes nothing. */
      from: "pending" | "requested";
      status: "requested" | "processed" | "failed" | "refund_due";
      providerReference?: string;
      reason?: string;
    },
  ) {
    const moved = await tx
      .update(orderRefund)
      .set({
        status: input.status,
        providerReference: input.providerReference ?? null,
        failureReason: input.reason ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orderRefund.orgId, ctx.orgId),
          eq(orderRefund.id, input.id),
          eq(orderRefund.status, input.from),
        ),
      )
      .returning({ id: orderRefund.id });
    return { changed: moved.length > 0 };
  },
  audit: (input, output) => ({ id: input.id, status: input.status, ...output }),
  details: (input) => ({ entity: "order_refund", entityId: input.id }),
});

type RefundHook = {
  key: string;
  kind: "refund.processed" | "refund.failed";
  reference: string;
};

/**
 * A Paystack `refund.*` webhook for an online order's payment (its transaction reference is the payment id): records
 * the outcome once. A replay, or a webhook for a refund that is not ours, changes nothing and answers false.
 */
export const applyOrderRefundEvent = defineCommand({
  name: "order.refund.webhook",
  async replay(tx, ctx, input: RefundHook) {
    const [seen] = await tx
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.orgId, ctx.orgId),
          eq(paymentEvent.provider, "paystack"),
          eq(paymentEvent.key, input.key),
        ),
      );
    return seen ? { output: false } : undefined;
  },
  async run(tx, ctx, input: RefundHook) {
    await tx.insert(paymentEvent).values({
      orgId: ctx.orgId,
      provider: "paystack",
      key: input.key,
      reference: input.reference,
      kind: input.kind,
    });
    const done = await tx
      .update(orderRefund)
      .set({
        status: input.kind === "refund.processed" ? "processed" : "failed",
        failureReason:
          input.kind === "refund.failed" ? "Paystack could not complete this refund." : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orderRefund.orgId, ctx.orgId),
          eq(orderRefund.orderPaymentId, input.reference),
          eq(orderRefund.status, "requested"),
        ),
      )
      .returning({ id: orderRefund.id });
    return done.length > 0;
  },
  audit: (input, applied) => ({ reference: input.reference, kind: input.kind, applied }),
});
