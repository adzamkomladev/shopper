import * as v from "valibot";
import { and, eq, inArray } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  onlineOrder,
  orderPayment,
  org,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { wholePesewas } from "@shopper/money";
import { sha256 } from "@shopper/utils";
import { payOrderInput, type PayOrderInput } from "../../schemas/orders/pay";
import { OrderError } from "../error";

type Starting = { orderId: string; digest: string; input: PayOrderInput; now: Date };

/**
 * Opens one attempt to pay a placed order, in one audited transaction. The amount is the order's gross, never the
 * request's. The same attempt asked for again is returned as it is; a different way of paying replaces the open
 * one (it can still settle if its payer approves, and the money then comes back as a duplicate).
 */
export async function startOrderPayment(
  db: ShopperDatabase,
  context: CommandContext,
  orderId: string,
  raw: unknown,
  now = new Date(),
) {
  const input = v.parse(payOrderInput, raw);
  return startCommand(db, context, { orderId, digest: await sha256(input.key), input, now });
}

const startCommand = defineCommand({
  name: "order.payment.start",
  async run(tx, context, starting: Starting) {
    const order = await lockOrder(tx, context.orgId, starting);
    const phone = starting.input.phone ?? order.customerPhone;
    const method = starting.input.method;
    const network = method === "momo" ? starting.input.network! : null;
    const [open] = await tx
      .select()
      .from(orderPayment)
      .where(
        and(
          eq(orderPayment.orgId, context.orgId),
          eq(orderPayment.orderId, order.id),
          inArray(orderPayment.status, ["pending", "otp"]),
        ),
      );
    if (open?.method === method && open.network === network && open.phone === phone)
      return { ...open, email: order.email };
    if (open)
      await tx
        .update(orderPayment)
        .set({
          status: "expired",
          failureReason: "Replaced by a new attempt",
          updatedAt: starting.now,
        })
        .where(and(eq(orderPayment.orgId, context.orgId), eq(orderPayment.id, open.id)));
    const [momoProvider] = await tx
      .select({ provider: org.momoProvider })
      .from(org)
      .where(eq(org.id, context.orgId));
    const [created] = await tx
      .insert(orderPayment)
      .values({
        id: v7(),
        orgId: context.orgId,
        orderId: order.id,
        provider: method === "card" ? "paystack" : momoProvider!.provider,
        method,
        network,
        phone,
        amount: wholePesewas(order.gross),
      })
      .returning();
    return { ...created!, email: order.email };
  },
  audit: (_starting, payment) => ({
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    method: payment.method,
    network: payment.network,
    phone: payment.phone,
    amount: payment.amount,
  }),
  details: (_starting, payment) => ({ entity: "order_payment", entityId: payment.id }),
});

async function lockOrder(tx: ShopperTransaction, orgId: string, starting: Starting) {
  const [order] = await tx
    .select()
    .from(onlineOrder)
    .where(and(eq(onlineOrder.orgId, orgId), eq(onlineOrder.id, starting.orderId)))
    .for("update");
  if (!order || order.viewTokenDigest !== starting.digest)
    throw new OrderError("not_found", "We could not find that order");
  if (order.status !== "placed")
    throw new OrderError("payment", "This order can no longer be paid", 409);
  if (order.holdExpiresAt <= starting.now)
    throw new OrderError("payment", "This order ran out of time. Please start again.", 409);
  return order;
}

/** Records the hosted checkout page Paystack opened for a card attempt. */
export const saveCheckoutUrl = defineCommand({
  name: "order.payment.checkout",
  async run(tx, context, input: { id: string; url: string }) {
    await tx
      .update(orderPayment)
      .set({ checkoutUrl: input.url, updatedAt: new Date() })
      .where(and(eq(orderPayment.orgId, context.orgId), eq(orderPayment.id, input.id)));
    return input;
  },
  audit: (input) => ({ id: input.id }),
  details: (input) => ({ entity: "order_payment", entityId: input.id }),
});
