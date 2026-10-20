import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { fromBigInt, money, type Money } from "@shopper/money";

export const moneyColumn = customType<{ data: Money; driverData: string }>({
  dataType: () => "bigint",
  toDriver: (value) => String(money(value)),
  fromDriver: (value) => fromBigInt(BigInt(value)),
});
const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`);
const times = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const cashRoundingModes = ["none", "10p"] as const;
export const org = pgTable(
  "org",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .generatedAlwaysAs(sql`id`),
    branchCounter: integer("branch_counter").notNull().default(0),
    name: text("name").notNull(),
    slug: text("slug")
      .notNull()
      .default(sql`uuidv7()::text`),
    logo: text("logo"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    mode: text("mode", { enum: ["full", "relay"] })
      .notNull()
      .default("full"),
    cashRounding: text("cash_rounding", { enum: cashRoundingModes }).notNull().default("10p"),
    ...times(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.slug),
    check("org_mode", sql`${t.mode} IN ('full', 'relay')`),
    check("org_cash_rounding", sql`${t.cashRounding} IN ('none', '10p')`),
  ],
);
export const tenant = () => ({
  id: id(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => org.id),
  ...times(),
});
export const store = pgTable(
  "store",
  {
    ...tenant(),
    name: text("name").notNull(),
    lastSeq: bigint("last_seq", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    cashRoundingStep: moneyColumn("cash_rounding_step")
      .notNull()
      .default(sql`100`),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    check("store_sequence_nonnegative", sql`${t.lastSeq} >= 0`),
    check("positive_cash_rounding_step", sql`${t.cashRoundingStep} > 0`),
  ],
);
export const branch = pgTable(
  "branch",
  {
    ...tenant(),
    storeId: uuid("store_id").notNull(),
    code: text("code").notNull().default(""),
    deviceCounter: integer("device_counter").notNull().default(0),
    name: text("name").notNull(),
    /** Who is texted when stock runs low: at most three. */
    alertPhones: text("alert_phones")
      .array()
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    check("branch_alert_phones", sql`cardinality(${t.alertPhones}) <= 3`),
    uniqueIndex("branch_org_code_unique")
      .on(t.orgId, t.code)
      .where(sql`${t.code} <> ''`),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
  ],
);
export const shopperMeta = pgTable(
  "shopper_meta",
  {
    ...tenant(),
    productVersion: text("product_version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    syncProtocol: integer("sync_protocol").notNull(),
    archiveFormat: integer("archive_format").notNull(),
    event: text("event", { enum: ["install", "upgrade"] }).notNull(),
  },
  (t) => [
    check("meta_event", sql`${t.event} IN ('install', 'upgrade')`),
    check(
      "meta_versions",
      sql`${t.schemaVersion} > 0 AND ${t.syncProtocol} > 0 AND ${t.archiveFormat} > 0`,
    ),
  ],
);
