import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const hostSession = sqliteTable("host_session", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  deviceId: text("device_id").notNull(),
  branchId: text("branch_id").notNull(),
  userId: text("user_id").notNull(),
  roleName: text("role_name").notNull(),
  issuedAt: text("issued_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  permissions: text("permissions", { mode: "json" }).$type<string[]>().notNull(),
  proof: text("proof").notNull(),
  parentSessionId: text("parent_session_id"),
});
