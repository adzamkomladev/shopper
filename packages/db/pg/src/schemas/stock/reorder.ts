import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch } from "../base";
import { product } from "../catalogue";

/** The stock level at or below which a product is low in a branch. */
export const reorderPoint = pgTable(
  "reorder_point",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    productId: uuid("product_id").notNull(),
    levelThousandths: bigint("level_thousandths", { mode: "number" }).notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.branchId, t.productId),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    check("reorder_point_level", sql`${t.levelThousandths} >= 0`),
  ],
);

/** One low-stock crossing; open until stock recovers. `sent_at` is set once the SMS went out. */
export const stockAlert = pgTable(
  "stock_alert",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    productId: uuid("product_id").notNull(),
    levelThousandths: bigint("level_thousandths", { mode: "number" }).notNull(),
    onHandThousandths: bigint("on_hand_thousandths", { mode: "number" }).notNull(),
    raisedAt: timestamp("raised_at", { withTimezone: true }).notNull().defaultNow(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    uniqueIndex("stock_alert_open")
      .on(t.orgId, t.branchId, t.productId)
      .where(sql`${t.clearedAt} IS NULL`),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
  ],
);
