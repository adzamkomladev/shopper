import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * A register's shift: opened with a float, counted blind (`declared`), then closed with its Z report. One shift
 * per register is unfinished at a time (`shift_current`). The upload columns are the closed shift's lane.
 */
export const shift = sqliteTable(
  "shift",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    branchId: text("branch_id").notNull(),
    storeId: text("store_id").notNull(),
    status: text("status", { enum: ["open", "declared", "closed"] }).notNull(),
    openedAt: text("opened_at").notNull(),
    openedBy: text("opened_by").notNull(),
    openedSessionId: text("opened_session_id").notNull(),
    float: integer("float").notNull(),
    floatCounts: text("float_counts", { mode: "json" }).$type<Record<string, number>>(),
    declaration: text("declaration", { mode: "json" }).$type<unknown>(),
    closedAt: text("closed_at"),
    closedBy: text("closed_by"),
    approverId: text("approver_id"),
    report: text("report", { mode: "json" }).$type<unknown>(),
    anchorSeq: integer("anchor_seq"),
    anchorHash: text("anchor_hash"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at"),
    blockedCode: text("blocked_code"),
    blockedReason: text("blocked_reason"),
    acceptedAt: text("accepted_at"),
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [unique().on(t.orgId, t.id)],
);

/** Cash drops (amount > 0) and audited no-sales (amount 0, reason required) inside a shift. */
export const shiftMovement = sqliteTable(
  "shift_movement",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    shiftId: text("shift_id").notNull(),
    kind: text("kind", { enum: ["drop", "no_sale"] }).notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason"),
    actorId: text("actor_id").notNull(),
    sessionId: text("session_id").notNull(),
    at: text("at").notNull(),
  },
  (t) => [index("shift_movement_shift").on(t.orgId, t.shiftId)],
);
