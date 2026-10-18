import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Staff who signed in on this register: the scrypt verifier that lets them sign in again offline. */
export const tillStaff = sqliteTable(
  "till_staff",
  {
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    verifier: text("verifier").notNull(),
    attempts: integer("attempts").notNull().default(0),
    /** Epoch ms; null when not locked. */
    lockedUntil: integer("locked_until"),
    verifiedAt: text("verified_at").notNull(),
    lastSessionId: text("last_session_id"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);
