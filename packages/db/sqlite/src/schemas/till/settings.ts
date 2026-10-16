import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/** One row per register: the settings document and its optimistic-concurrency revision. */
export const tillSetting = sqliteTable(
  "till_setting",
  {
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    revision: integer("revision").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [unique().on(t.orgId, t.deviceId)],
);
