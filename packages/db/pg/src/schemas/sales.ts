import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch, store } from "./base";
import { user } from "./auth";
import { device, cashierSession } from "./devices";
import { product, price, taxRule } from "./catalogue";

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
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.deviceId, t.localId),
    unique().on(t.orgId, t.receiptNumber),
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
