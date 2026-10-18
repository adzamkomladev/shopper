import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Managers who can approve on this register: the server's PIN hash and the approval grants they hold. */
export const tillApprover = sqliteTable(
  "till_approver",
  {
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    pinHash: text("pin_hash").notNull(),
    permissions: text("permissions", { mode: "json" }).$type<string[]>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    /** Epoch ms; null when not locked. */
    lockedUntil: integer("locked_until"),
    refreshedAt: text("refreshed_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);
