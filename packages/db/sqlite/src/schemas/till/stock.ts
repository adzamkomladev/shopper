import { foreignKey, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { localSale } from "./sales";

export const stockMovement = sqliteTable(
  "stock_movement",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    branchId: text("branch_id").notNull(),
    productId: text("product_id").notNull(),
    saleId: text("sale_id").notNull(),
    saleLineId: text("sale_line_id").notNull(),
    quantityThousandths: integer("quantity_thousandths").notNull(),
    reason: text("reason", { enum: ["sale"] }).notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.saleLineId),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [localSale.orgId, localSale.id] }),
  ],
);
