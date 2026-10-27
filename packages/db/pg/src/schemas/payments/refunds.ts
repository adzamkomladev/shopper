import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tenant, moneyColumn } from "../base";
import { refund } from "../refunds";
import { payment } from "./base";

export const paymentRefundStatuses = ["pending", "processed", "failed", "manual"] as const;

/** Money sent back to a MoMo wallet for a refund: the compensation of a confirmed payment. */
export const paymentRefund = pgTable(
  "payment_refund",
  {
    ...tenant(),
    paymentId: uuid("payment_id").notNull(),
    refundId: uuid("refund_id").notNull(),
    amount: moneyColumn("amount").notNull(),
    status: text("status", { enum: paymentRefundStatuses }).notNull().default("pending"),
    providerReference: text("provider_reference"),
    failureReason: text("failure_reason"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.refundId, t.paymentId),
    foreignKey({ columns: [t.orgId, t.paymentId], foreignColumns: [payment.orgId, payment.id] }),
    foreignKey({ columns: [t.orgId, t.refundId], foreignColumns: [refund.orgId, refund.id] }),
    // MoMo moves whole pesewas only.
    check("payment_refund_amount", sql`${t.amount} > 0 AND ${t.amount} % 100 = 0`),
    check(
      "payment_refund_status",
      sql`${t.status} IN ('pending', 'processed', 'failed', 'manual')`,
    ),
  ],
);
