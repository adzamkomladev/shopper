import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { moneyColumn, momoProviders, tenant } from "../base";
import { paymentNetworks, paymentStatuses } from "../payments/base";
import { onlineOrder } from "./base";

export const orderPaymentMethods = ["card", "momo"] as const;

/**
 * One attempt to pay an online order. `id` is the payment reference the provider echoes back and the id of the
 * Payment workflow instance. An order may have several attempts but only one open at a time; `amount` is copied from
 * the order's gross, never from a request.
 */
export const orderPayment = pgTable(
  "order_payment",
  {
    ...tenant(),
    orderId: uuid("order_id").notNull(),
    provider: text("provider", { enum: momoProviders }).notNull(),
    method: text("method", { enum: orderPaymentMethods }).notNull(),
    network: text("network", { enum: paymentNetworks }),
    phone: text("phone").notNull(),
    amount: moneyColumn("amount").notNull(),
    status: text("status", { enum: paymentStatuses }).notNull().default("pending"),
    providerReference: text("provider_reference"),
    checkoutUrl: text("checkout_url"),
    failureReason: text("failure_reason"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    uniqueIndex("order_payment_open")
      .on(t.orgId, t.orderId)
      .where(sql`${t.status} IN ('pending', 'otp')`),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    check("order_payment_amount", sql`${t.amount} > 0 AND ${t.amount} % 100 = 0`),
    check("order_payment_method", sql`${t.method} IN ('card', 'momo')`),
    check("order_payment_provider", sql`${t.provider} IN ('paystack', 'hubtel')`),
    check("order_payment_network", sql`(${t.method} = 'momo') = (${t.network} IS NOT NULL)`),
    check(
      "order_payment_status",
      sql`${t.status} IN ('pending', 'otp', 'confirmed', 'failed', 'expired')`,
    ),
    check(
      "order_payment_confirmed",
      sql`(${t.status} = 'confirmed') = (${t.confirmedAt} IS NOT NULL)`,
    ),
  ],
);

export const orderRefundReasons = [
  "late_payment",
  "duplicate_payment",
  "not_accepted",
  "cancelled",
] as const;
export const orderRefundStatuses = ["pending", "processed", "failed", "refund_due"] as const;

/**
 * Money owed back to the payer of an order: the compensation of a confirmed payment that did not become a kept
 * order. `refund_due` is a payment the provider cannot refund automatically (Hubtel): the store sends it by hand.
 */
export const orderRefund = pgTable(
  "order_refund",
  {
    ...tenant(),
    orderPaymentId: uuid("order_payment_id").notNull(),
    amount: moneyColumn("amount").notNull(),
    reason: text("reason", { enum: orderRefundReasons }).notNull(),
    status: text("status", { enum: orderRefundStatuses }).notNull().default("pending"),
    providerReference: text("provider_reference"),
    failureReason: text("failure_reason"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    // One refund per payment: a redelivered message or a second sweep can never pay the money back twice.
    unique("order_refund_payment").on(t.orgId, t.orderPaymentId),
    foreignKey({
      columns: [t.orgId, t.orderPaymentId],
      foreignColumns: [orderPayment.orgId, orderPayment.id],
    }),
    check("order_refund_amount", sql`${t.amount} > 0 AND ${t.amount} % 100 = 0`),
    check(
      "order_refund_status",
      sql`${t.status} IN ('pending', 'processed', 'failed', 'refund_due')`,
    ),
    check(
      "order_refund_reason",
      sql`${t.reason} IN ('late_payment', 'duplicate_payment', 'not_accepted', 'cancelled')`,
    ),
  ],
);
