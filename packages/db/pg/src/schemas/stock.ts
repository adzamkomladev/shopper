import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch } from "./base";
import { product } from "./catalogue";
import { sale, saleLine } from "./sales";

export const stockReasons = ["sale", "adjustment", "return"] as const;

/** Signed stock ledger: a sale is negative. */
export const stockMovement = pgTable(
  "stock_movement",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    productId: uuid("product_id").notNull(),
    saleId: uuid("sale_id"),
    saleLineId: uuid("sale_line_id"),
    quantityThousandths: bigint("quantity_thousandths", { mode: "number" }).notNull(),
    reason: text("reason", { enum: stockReasons }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("stock_movement_product").on(t.orgId, t.branchId, t.productId, t.occurredAt),
    index("stock_movement_sale").on(t.orgId, t.saleId),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    foreignKey({ columns: [t.orgId, t.saleLineId], foreignColumns: [saleLine.orgId, saleLine.id] }),
    check("stock_movement_reason", sql`${t.reason} IN ('sale', 'adjustment', 'return')`),
    check("stock_movement_quantity", sql`${t.quantityThousandths} <> 0`),
    check(
      "stock_movement_sale",
      sql`${t.reason} <> 'sale' OR (${t.saleId} IS NOT NULL AND ${t.quantityThousandths} < 0)`,
    ),
  ],
);
