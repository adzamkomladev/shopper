import { foreignKey, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { localSale } from "./sales";

export const stockMovement = sqliteTable(
  "stock_movement",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    branchId: text("branch_id").notNull(),
    productId: text("product_id").notNull(),
    /** Set on sales, and on returns of a sale made on this till. */
    saleId: text("sale_id"),
    saleLineId: text("sale_line_id"),
    refundId: text("refund_id"),
    refundLineId: text("refund_line_id"),
    /** Negative for a sale, positive for a return. */
    quantityThousandths: integer("quantity_thousandths").notNull(),
    reason: text("reason", { enum: ["sale", "return"] }).notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (t) => [
    uniqueIndex("stock_movement_sale_line")
      .on(t.orgId, t.saleLineId)
      .where(sql`reason = 'sale'`),
    uniqueIndex("stock_movement_refund_line")
      .on(t.orgId, t.refundLineId)
      .where(sql`reason = 'return'`),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [localSale.orgId, localSale.id] }),
  ],
);

/** Stock counts and receipts queued on the till until the upload worker delivers them. */
export const stockDocument = sqliteTable("stock_document", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  deviceId: text("device_id").notNull(),
  kind: text("kind", { enum: ["count", "receipt"] }).notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  sessionId: text("session_id").notNull(),
  createdAt: text("created_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at"),
  blockedCode: text("blocked_code"),
  blockedReason: text("blocked_reason"),
  acceptedAt: text("accepted_at"),
  result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
});
