import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const tillAudit = sqliteTable(
  "till_audit",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    actorId: text("actor_id"),
    role: text("role"),
    deviceId: text("device_id"),
    branchId: text("branch_id"),
    approverId: text("approver_id"),
    reason: text("reason"),
    deviceTime: integer("device_time", { mode: "timestamp_ms" }),
    entity: text("entity"),
    entityId: text("entity_id"),
    before: text("before", { mode: "json" }).$type<unknown>(),
    after: text("after", { mode: "json" }).$type<unknown>(),
    appVersion: text("app_version").notNull(),
    command: text("command").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    chainSeq: integer("chain_seq"),
    prevHash: text("prev_hash"),
    hash: text("hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [unique().on(t.orgId, t.chainSeq)],
);
