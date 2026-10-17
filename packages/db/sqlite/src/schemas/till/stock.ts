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
