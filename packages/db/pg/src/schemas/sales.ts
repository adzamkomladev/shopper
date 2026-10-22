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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch, store, moneyColumn } from "./base";
import { user } from "./auth";
import { device, cashierSession } from "./devices";
import { product, price, taxRule } from "./catalogue";
import { payment } from "./payments";
import { asset } from "./assets";
import { customer } from "./customers/base";
import { accountHold } from "./customers/holds";

export const sale = pgTable(
  "sale",
  {
    ...tenant(),
    deviceId: uuid("device_id").notNull(),
    localId: uuid("local_id").notNull(),
    storeId: uuid("store_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    cashierId: uuid("cashier_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    appVersion: text("app_version").notNull(),
    eventVersion: bigint("event_version", { mode: "number" }).notNull().default(1),
    deviceTime: timestamp("device_time", { withTimezone: true }).notNull(),
    receiptNumber: text("receipt_number"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").notNull(),
    contentHash: text("content_hash").notNull(),
    storeSequence: bigint("store_sequence", { mode: "bigint" }),
    status: text("status").notNull().default("completed"),
    total: moneyColumn("total"),
    cashRounding: moneyColumn("cash_rounding")
      .notNull()
      .default(sql`0`),
    paid: moneyColumn("paid"),
    change: moneyColumn("change")
      .notNull()
      .default(sql`0`),
    receipt: jsonb("receipt"),
    receiptAssetId: uuid("receipt_asset_id"),
    customerId: uuid("customer_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.deviceId, t.localId),
    index("sale_customer").on(t.orgId, t.customerId),
    foreignKey({ columns: [t.orgId, t.customerId], foreignColumns: [customer.orgId, customer.id] }),
    foreignKey({ columns: [t.orgId, t.receiptAssetId], foreignColumns: [asset.orgId, asset.id] }),
    uniqueIndex("sale_receipt_unique").on(t.orgId, t.receiptNumber),
    unique().on(t.orgId, t.storeId, t.storeSequence),
    check("sale_sequence_positive", sql`${t.storeSequence} IS NULL OR ${t.storeSequence} > 0`),
    check("sale_event_version_positive", sql`${t.eventVersion} > 0`),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.cashierId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({
      columns: [t.orgId, t.sessionId],
      foreignColumns: [cashierSession.orgId, cashierSession.id],
    }),
  ],
);
export const saleLine = pgTable(
  "sale_line",
  {
    ...tenant(),
    saleId: uuid("sale_id").notNull(),
    productId: uuid("product_id").notNull(),
    priceId: uuid("price_id").notNull(),
    taxRuleId: uuid("tax_rule_id").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    foreignKey({ columns: [t.orgId, t.priceId], foreignColumns: [price.orgId, price.id] }),
    foreignKey({ columns: [t.orgId, t.taxRuleId], foreignColumns: [taxRule.orgId, taxRule.id] }),
  ],
);

export const tenderKinds = ["cash", "momo", "card"] as const;
/** What a sale can be paid with: the money tenders plus an account tender (customer credit or points). */
export const saleTenderKinds = [...tenderKinds, "credit", "loyalty"] as const;
export const saleTender = pgTable(
  "sale_tender",
  {
    ...tenant(),
    saleId: uuid("sale_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind", { enum: saleTenderKinds }).notNull(),
    amount: moneyColumn("amount").notNull(),
    reference: text("reference"),
    approvalCode: text("approval_code"),
    last4: text("last4"),
    network: text("network"),
    paymentId: uuid("payment_id"),
    /** The account hold an account tender spends: the hold's id is the tender id. */
    holdId: uuid("hold_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.saleId, t.position),
    // A confirmed MoMo payment settles one tender only.
    unique().on(t.orgId, t.paymentId),
    unique().on(t.orgId, t.holdId),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    foreignKey({ columns: [t.orgId, t.paymentId], foreignColumns: [payment.orgId, payment.id] }),
    foreignKey({
      columns: [t.orgId, t.holdId],
      foreignColumns: [accountHold.orgId, accountHold.id],
    }),
    check("sale_tender_kind", sql`${t.kind} IN ('cash', 'momo', 'card', 'credit', 'loyalty')`),
    check(
      "sale_tender_hold",
      sql`(${t.kind} IN ('credit', 'loyalty')) = (${t.holdId} IS NOT NULL)`,
    ),
    check("sale_tender_amount", sql`${t.amount} > 0 OR (${t.kind} = 'cash' AND ${t.amount} = 0)`),
    check("sale_tender_position", sql`${t.position} >= 0`),
    check("sale_tender_momo_payment", sql`${t.kind} <> 'momo' OR ${t.paymentId} IS NOT NULL`),
  ],
);
