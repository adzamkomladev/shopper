import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * Refunds made on this till, with the event the upload worker sends. A `server` refund is of a sale made on
 * another register: it is born accepted and keeps the sale snapshot it was priced from in `original`.
 */
export const refund = sqliteTable(
  "refund",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    originalSaleId: text("original_sale_id").notNull(),
    origin: text("origin", { enum: ["local", "server"] }).notNull(),
    original: text("original", { mode: "json" }).$type<unknown>(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    receipt: text("receipt", { mode: "json" }).$type<unknown>().notNull(),
    sessionId: text("session_id").notNull(),
    createdAt: text("created_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at"),
    blockedCode: text("blocked_code"),
    blockedReason: text("blocked_reason"),
    acceptedAt: text("accepted_at"),
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
    shiftId: text("shift_id"),
  },
  (t) => [unique().on(t.orgId, t.id)],
);
