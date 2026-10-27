import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { branch, moneyColumn, store, tenant } from "./base";
import { user } from "./auth";
import { product } from "./catalogue";
import { saleTenderKinds } from "./sales";

export const storeDayStatuses = ["pending", "open", "closed"] as const;

/**
 * One store's trading day (Accra date), mirrored from its store-day workflow. `rolled_at` set means the day's
 * report rows are current; a sale or refund landing on the day clears it, so readers fold that day live again.
 */
export const storeDay = pgTable(
  "store_day",
  {
    ...tenant(),
    storeId: uuid("store_id").notNull(),
    day: date("day").notNull(),
    status: text("status", { enum: storeDayStatuses }).notNull().default("pending"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    rolledAt: timestamp("rolled_at", { withTimezone: true }),
    summary: jsonb("summary"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.storeId, t.day),
    index("store_day_rolled").on(t.orgId, t.day),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
    check("store_day_status", sql`${t.status} IN ('pending', 'open', 'closed')`),
  ],
);

/** The key every rollup row starts with: whose, where and which Accra day. */
const grain = () => ({
  ...tenant(),
  storeId: uuid("store_id").notNull(),
  branchId: uuid("branch_id").notNull(),
  day: date("day").notNull(),
});

/** Sales and refunds per branch, day, Accra hour and cashier: amounts from the sale totals as stored. */
export const reportSales = pgTable(
  "report_sales",
  {
    ...grain(),
    hour: smallint("hour").notNull(),
    cashierId: uuid("cashier_id").notNull(),
    sales: integer("sales").notNull(),
    items: bigint("items", { mode: "number" }).notNull(),
    gross: moneyColumn("gross").notNull(),
    discount: moneyColumn("discount").notNull(),
    tax: moneyColumn("tax").notNull(),
    net: moneyColumn("net").notNull(),
    rounding: moneyColumn("rounding").notNull(),
    refunds: integer("refunds").notNull(),
    refundGross: moneyColumn("refund_gross").notNull(),
    refundTax: moneyColumn("refund_tax").notNull(),
    refundNet: moneyColumn("refund_net").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.storeId, t.day, t.branchId, t.hour, t.cashierId),
    index("report_sales_day").on(t.orgId, t.day),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.cashierId], foreignColumns: [user.orgId, user.id] }),
    check("report_sales_hour", sql`${t.hour} BETWEEN 0 AND 23`),
  ],
);

/** Money taken per tender kind (cash net of change) and refunded through it. */
export const reportTender = pgTable(
  "report_tender",
  {
    ...grain(),
    kind: text("kind", { enum: saleTenderKinds }).notNull(),
    count: integer("count").notNull(),
    amount: moneyColumn("amount").notNull(),
    refunded: moneyColumn("refunded").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.storeId, t.day, t.branchId, t.kind),
    index("report_tender_day").on(t.orgId, t.day),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
  ],
);

/**
 * Each product's sold and refunded lines per branch and day, from the line tax snapshots. Cost is the quantity at
 * the unit cost of the branch's latest costed receipt on or before the day; lines without one are counted apart.
 */
export const reportProduct = pgTable(
  "report_product",
  {
    ...grain(),
    productId: uuid("product_id").notNull(),
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    gross: moneyColumn("gross").notNull(),
    discount: moneyColumn("discount").notNull(),
    tax: moneyColumn("tax").notNull(),
    net: moneyColumn("net").notNull(),
    cost: moneyColumn("cost").notNull(),
    uncosted: bigint("uncosted", { mode: "number" }).notNull(),
    refundQuantity: bigint("refund_quantity", { mode: "number" }).notNull(),
    refundGross: moneyColumn("refund_gross").notNull(),
    refundNet: moneyColumn("refund_net").notNull(),
    refundCost: moneyColumn("refund_cost").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.storeId, t.day, t.branchId, t.productId),
    index("report_product_day").on(t.orgId, t.day),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
  ],
);
