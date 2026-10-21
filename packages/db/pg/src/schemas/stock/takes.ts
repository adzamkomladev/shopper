import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch } from "../base";
import { user } from "../auth";
import { category, product } from "../catalogue";

export const stockTakeScopes = ["full", "category"] as const;
export const stockTakeStatuses = ["open", "posted", "cancelled"] as const;

/** A counting round over a branch's products; one may be open per branch. */
export const stockTake = pgTable(
  "stock_take",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    scope: text("scope", { enum: stockTakeScopes }).notNull(),
    categoryId: uuid("category_id"),
    status: text("status", { enum: stockTakeStatuses }).notNull().default("open"),
    startedBy: uuid("started_by").notNull(),
    closedBy: uuid("closed_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    uniqueIndex("stock_take_open")
      .on(t.orgId, t.branchId)
      .where(sql`${t.status} = 'open'`),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.categoryId], foreignColumns: [category.orgId, category.id] }),
    foreignKey({ columns: [t.orgId, t.startedBy], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.closedBy], foreignColumns: [user.orgId, user.id] }),
    check("stock_take_scope", sql`${t.scope} IN ('full', 'category')`),
    check("stock_take_status", sql`${t.status} IN ('open', 'posted', 'cancelled')`),
    check("stock_take_category", sql`(${t.scope} = 'category') = (${t.categoryId} IS NOT NULL)`),
  ],
);

/** One product on a take's sheet; the counted columns are set together, the expected quantity at post. */
export const stockTakeLine = pgTable(
  "stock_take_line",
  {
    ...tenant(),
    takeId: uuid("take_id").notNull(),
    productId: uuid("product_id").notNull(),
    countedThousandths: bigint("counted_thousandths", { mode: "number" }),
    countedAt: timestamp("counted_at", { withTimezone: true }),
    countedBy: uuid("counted_by"),
    expectedThousandths: bigint("expected_thousandths", { mode: "number" }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.takeId, t.productId),
    foreignKey({ columns: [t.orgId, t.takeId], foreignColumns: [stockTake.orgId, stockTake.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    foreignKey({ columns: [t.orgId, t.countedBy], foreignColumns: [user.orgId, user.id] }),
    check("stock_take_line_counted", sql`${t.countedThousandths} >= 0`),
    check(
      "stock_take_line_count_set",
      sql`(${t.countedThousandths} IS NULL) = (${t.countedAt} IS NULL) AND (${t.countedAt} IS NULL) = (${t.countedBy} IS NULL)`,
    ),
  ],
);
