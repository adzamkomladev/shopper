import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch, store, moneyColumn } from "./base";
import { user } from "./auth";
import { device, cashierSession } from "./devices";
import { product } from "./catalogue";
import { sale, saleLine, tenderKinds } from "./sales";

/** A refund is its own record, never a negative sale; its lines carry the tax share of the sold lines. */
export const refund = pgTable(
  "refund",
  {
    ...tenant(),
    deviceId: uuid("device_id").notNull(),
    storeId: uuid("store_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    cashierId: uuid("cashier_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    approverId: uuid("approver_id"),
    originalSaleId: uuid("original_sale_id").notNull(),
    reason: text("reason").notNull(),
    tenderKind: text("tender_kind", { enum: tenderKinds }).notNull(),
    tenderReference: text("tender_reference"),
    gross: moneyColumn("gross").notNull(),
    cashRounding: moneyColumn("cash_rounding").notNull(),
    total: moneyColumn("total").notNull(),
    /** The part of the refund credited to the customer's account, and the points given back. */
    accountCredit: moneyColumn("account_credit")
      .notNull()
      .default(sql`0`),
    pointsReturned: integer("points_returned").notNull().default(0),
    appVersion: text("app_version").notNull(),
    eventVersion: bigint("event_version", { mode: "number" }).notNull().default(1),
    deviceTime: timestamp("device_time", { withTimezone: true }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    receipt: jsonb("receipt"),
    payload: jsonb("payload").notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("refund_sale").on(t.orgId, t.originalSaleId),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.cashierId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.approverId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({
      columns: [t.orgId, t.sessionId],
      foreignColumns: [cashierSession.orgId, cashierSession.id],
    }),
    foreignKey({ columns: [t.orgId, t.originalSaleId], foreignColumns: [sale.orgId, sale.id] }),
    check("refund_tender_kind", sql`${t.tenderKind} IN ('cash', 'momo', 'card')`),
    check(
      "refund_tender_reference",
      sql`${t.tenderKind} = 'cash' OR (${t.tenderReference} IS NOT NULL AND ${t.tenderReference} <> '')`,
    ),
    check("refund_amounts", sql`${t.gross} >= 0 AND ${t.total} >= 0`),
    check("refund_account", sql`${t.accountCredit} >= 0 AND ${t.pointsReturned} >= 0`),
    check("refund_event_version_positive", sql`${t.eventVersion} > 0`),
  ],
);

export const refundLine = pgTable(
  "refund_line",
  {
    ...tenant(),
    refundId: uuid("refund_id").notNull(),
    originalLineId: uuid("original_line_id").notNull(),
    productId: uuid("product_id").notNull(),
    quantityThousandths: bigint("quantity_thousandths", { mode: "number" }).notNull(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("refund_line_original").on(t.orgId, t.originalLineId),
    foreignKey({ columns: [t.orgId, t.refundId], foreignColumns: [refund.orgId, refund.id] }),
    foreignKey({
      columns: [t.orgId, t.originalLineId],
      foreignColumns: [saleLine.orgId, saleLine.id],
    }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    check("refund_line_quantity", sql`${t.quantityThousandths} > 0`),
  ],
);
