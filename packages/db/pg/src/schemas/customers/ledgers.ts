import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, moneyColumn } from "../base";
import { user } from "../auth";
import { sale } from "../sales";
import { refund } from "../refunds";
import { customer } from "./base";
import { accountHold } from "./holds";

export const creditKinds = ["charge", "payment", "credit_note", "interest", "transfer"] as const;
export const paymentMethods = ["cash", "momo", "card"] as const;
export const loyaltyReasons = ["earn", "redeem", "reverse", "expire", "transfer"] as const;

/**
 * Append-only credit ledger. Charges and interest are positive, payments and credit notes negative;
 * the sum is what the customer owes (below zero is a deposit).
 */
export const creditEntry = pgTable(
  "credit_entry",
  {
    ...tenant(),
    customerId: uuid("customer_id").notNull(),
    kind: text("kind", { enum: creditKinds }).notNull(),
    amount: moneyColumn("amount").notNull(),
    saleId: uuid("sale_id"),
    refundId: uuid("refund_id"),
    holdId: uuid("hold_id"),
    method: text("method", { enum: paymentMethods }),
    /** The till's shift, with no foreign key: the server's shift row only arrives with the Z. */
    shiftId: uuid("shift_id"),
    reason: text("reason"),
    /** The month an interest entry belongs to (YYYY-MM); one per customer. */
    period: text("period"),
    actorId: uuid("actor_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.holdId),
    unique().on(t.orgId, t.customerId, t.period),
    index("credit_entry_customer").on(t.orgId, t.customerId, t.occurredAt),
    foreignKey({ columns: [t.orgId, t.customerId], foreignColumns: [customer.orgId, customer.id] }),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    foreignKey({ columns: [t.orgId, t.refundId], foreignColumns: [refund.orgId, refund.id] }),
    foreignKey({
      columns: [t.orgId, t.holdId],
      foreignColumns: [accountHold.orgId, accountHold.id],
    }),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    check(
      "credit_entry_kind",
      sql`${t.kind} IN ('charge', 'payment', 'credit_note', 'interest', 'transfer')`,
    ),
    check(
      "credit_entry_sign",
      sql`${t.kind} = 'transfer' OR (${t.kind} IN ('charge', 'interest') AND ${t.amount} > 0)
        OR (${t.kind} IN ('payment', 'credit_note') AND ${t.amount} < 0)`,
    ),
    check("credit_entry_amount", sql`${t.amount} <> 0`),
    check("credit_entry_method", sql`(${t.kind} = 'payment') = (${t.method} IS NOT NULL)`),
    check(
      "credit_entry_method_value",
      sql`${t.method} IS NULL OR ${t.method} IN ('cash', 'momo', 'card')`,
    ),
    check(
      "credit_entry_reason",
      sql`${t.kind} <> 'credit_note' OR (${t.reason} IS NOT NULL AND ${t.reason} <> '')`,
    ),
    check("credit_entry_period", sql`(${t.kind} = 'interest') = (${t.period} IS NOT NULL)`),
  ],
);

/** Append-only points ledger; the sum is the balance. An earn carries the rate and point value it used. */
export const loyaltyEntry = pgTable(
  "loyalty_entry",
  {
    ...tenant(),
    customerId: uuid("customer_id").notNull(),
    reason: text("reason", { enum: loyaltyReasons }).notNull(),
    points: integer("points").notNull(),
    saleId: uuid("sale_id"),
    refundId: uuid("refund_id"),
    holdId: uuid("hold_id"),
    rateBps: integer("rate_bps"),
    pointValue: moneyColumn("point_value"),
    /** The earn entry an expiry takes points from. */
    lotId: uuid("lot_id"),
    actorId: uuid("actor_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.holdId),
    uniqueIndex("loyalty_entry_earn_sale")
      .on(t.orgId, t.saleId)
      .where(sql`${t.reason} = 'earn'`),
    uniqueIndex("loyalty_entry_expire_lot")
      .on(t.orgId, t.lotId)
      .where(sql`${t.reason} = 'expire'`),
    index("loyalty_entry_customer").on(t.orgId, t.customerId, t.occurredAt),
    foreignKey({ columns: [t.orgId, t.customerId], foreignColumns: [customer.orgId, customer.id] }),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    foreignKey({ columns: [t.orgId, t.refundId], foreignColumns: [refund.orgId, refund.id] }),
    foreignKey({
      columns: [t.orgId, t.holdId],
      foreignColumns: [accountHold.orgId, accountHold.id],
    }),
    foreignKey({
      columns: [t.orgId, t.lotId],
      foreignColumns: [t.orgId, t.id],
      name: "loyalty_entry_org_id_lot_id_loyalty_entry_org_id_id_fk",
    }),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    check(
      "loyalty_entry_reason",
      sql`${t.reason} IN ('earn', 'redeem', 'reverse', 'expire', 'transfer')`,
    ),
    check("loyalty_entry_points", sql`${t.points} <> 0`),
    check(
      "loyalty_entry_sign",
      sql`(${t.reason} = 'earn' AND ${t.points} > 0) OR (${t.reason} IN ('redeem', 'expire') AND ${t.points} < 0) OR ${t.reason} IN ('reverse', 'transfer')`,
    ),
  ],
);
