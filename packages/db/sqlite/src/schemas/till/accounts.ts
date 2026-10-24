import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Cash and MoMo taken on customers' accounts at the drawer, kept as `account.payment` documents: the shift's expected
 * cash is read from them, and the upload lane carries them to the server once the customer has gone first.
 */
export const accountPayment = sqliteTable(
  "account_payment",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    shiftId: text("shift_id").notNull(),
    customerId: text("customer_id").notNull(),
    method: text("method", { enum: ["cash", "momo"] }).notNull(),
    amount: integer("amount").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    sessionId: text("session_id").notNull(),
    createdAt: text("created_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at"),
    blockedCode: text("blocked_code"),
    blockedReason: text("blocked_reason"),
    acceptedAt: text("accepted_at"),
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [
    index("account_payment_shift").on(t.orgId, t.shiftId),
    index("account_payment_customer").on(t.orgId, t.customerId),
  ],
);
