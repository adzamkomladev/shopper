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
  uuid,
} from "drizzle-orm/pg-core";
import { branch, tenant } from "../base";
import { product } from "../catalogue";
import { onlineOrder } from "./base";

export const holdReleaseReasons = ["expired", "cancelled", "fulfilled"] as const;

/**
 * Stock an online order keeps aside at a branch until `expires_at`. Available online = on hand − unreleased holds;
 * the StockHold coordinator releases holds as they expire.
 */
export const stockHold = pgTable(
  "stock_hold",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    productId: uuid("product_id").notNull(),
    orderId: uuid("order_id").notNull(),
    quantityThousandths: integer("quantity_thousandths").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releaseReason: text("release_reason", { enum: holdReleaseReasons }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("stock_hold_line").on(t.orgId, t.orderId, t.productId),
    index("stock_hold_active")
      .on(t.orgId, t.branchId, t.productId)
      .where(sql`${t.releasedAt} IS NULL`),
    index("stock_hold_expiry")
      .on(t.orgId, t.branchId, t.expiresAt)
      .where(sql`${t.releasedAt} IS NULL`),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    check("stock_hold_quantity", sql`${t.quantityThousandths} > 0`),
    check("stock_hold_release", sql`(${t.releasedAt} IS NULL) = (${t.releaseReason} IS NULL)`),
  ],
);
