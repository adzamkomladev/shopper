import { foreignKey, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const localSale = sqliteTable(
  "local_sale",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    localId: text("local_id").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
    contentHash: text("content_hash").notNull(),
    storeSequence: text("store_sequence"),
    occurredAt: text("occurred_at"),
  },
  (t) => [
    unique().on(t.deviceId, t.localId),
    unique().on(t.orgId, t.deviceId, t.localId),
    unique().on(t.orgId, t.id),
  ],
);

export const saleLine = sqliteTable(
  "sale_line",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    saleId: text("sale_id").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [localSale.orgId, localSale.id] }),
  ],
);

export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    localId: text("local_id").notNull(),
    localSeq: integer("local_seq").notNull(),
    event: text("event", { mode: "json" }).$type<unknown>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    blockedReason: text("blocked_reason"),
  },
  (t) => [
    unique().on(t.orgId, t.deviceId, t.localSeq),
    unique().on(t.orgId, t.deviceId, t.localId),
    foreignKey({
      columns: [t.orgId, t.deviceId, t.localId],
      foreignColumns: [localSale.orgId, localSale.deviceId, localSale.localId],
    }),
  ],
);

export const tillState = sqliteTable(
  "till_state",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    deviceId: text("device_id").notNull(),
    lastOutboxSeq: integer("last_outbox_seq").notNull().default(0),
    receiptLastUsed: integer("receipt_last_used").notNull().default(0),
    receiptOverflowCounter: integer("receipt_overflow_counter").notNull().default(0),
    branchCode: text("branch_code"),
    deviceCode: text("device_code"),
    clockOffsetMs: integer("clock_offset_ms").notNull().default(0),
    receiptBlocks: text("receipt_blocks", { mode: "json" })
      .$type<{ start: number; end: number }[]>()
      .notNull()
      .default([]),
    pullInitialized: integer("pull_initialized", { mode: "boolean" }).notNull().default(false),
    pullCursor: text("pull_cursor").notNull().default("0"),
    referenceVersion: integer("reference_version").notNull().default(1),
  },
  (t) => [unique().on(t.orgId, t.deviceId)],
);

export const reference = sqliteTable(
  "reference",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    entity: text("entity").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
  },
  (t) => [unique().on(t.orgId, t.entity, t.id)],
);
