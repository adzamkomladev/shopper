import { sql } from "drizzle-orm";
import {
  check,
  customType,
  date,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { fromBigInt, money, type Money } from "@shopper/money";
import type { TaxClass } from "@shopper/tax";

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
export const org = pgTable(
  "org",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .generatedAlwaysAs(sql`id`),
    name: text("name").notNull(),
    mode: text("mode", { enum: ["full", "relay"] })
      .notNull()
      .default("full"),
    ...times(),
  },
  (t) => [unique().on(t.orgId, t.id), check("org_mode", sql`${t.mode} IN ('full', 'relay')`)],
);
const tenant = () => ({
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
    cashRoundingStep: moneyColumn("cash_rounding_step")
      .notNull()
      .default(sql`100`),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    check("positive_cash_rounding_step", sql`${t.cashRoundingStep} > 0`),
  ],
);
export const branch = pgTable(
  "branch",
  {
    ...tenant(),
    storeId: uuid("store_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
  ],
);
export const device = pgTable(
  "device",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
  ],
);
export const user = pgTable(
  "user",
  {
    ...tenant(),
    email: text("email").notNull(),
    name: text("name").notNull(),
  },
  (t) => [unique().on(t.orgId, t.id), unique().on(t.orgId, t.email)],
);
export const role = pgTable(
  "role",
  {
    ...tenant(),
    name: text("name").notNull(),
  },
  (t) => [unique().on(t.orgId, t.id), unique().on(t.orgId, t.name)],
);
export const permission = pgTable(
  "permission",
  {
    ...tenant(),
    code: text("code").notNull(),
  },
  (t) => [unique().on(t.orgId, t.id), unique().on(t.orgId, t.code)],
);
export const rolePermission = pgTable(
  "role_permission",
  {
    ...tenant(),
    roleId: uuid("role_id").notNull(),
    permissionId: uuid("permission_id").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.roleId, t.permissionId),
    foreignKey({ columns: [t.orgId, t.roleId], foreignColumns: [role.orgId, role.id] }),
    foreignKey({
      columns: [t.orgId, t.permissionId],
      foreignColumns: [permission.orgId, permission.id],
    }),
  ],
);
export const taxClass = pgTable(
  "tax_class",
  {
    ...tenant(),
    code: text("code").$type<TaxClass>().notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.code),
    check("tax_class_code", sql`${t.code} IN ('standard', 'zero-rated', 'exempt')`),
  ],
);
export const taxRule = pgTable(
  "tax_rule",
  {
    ...tenant(),
    effectiveFrom: date("effective_from").notNull(),
    vatBps: integer("vat_bps").notNull(),
    nhilBps: integer("nhil_bps").notNull(),
    getfundBps: integer("getfund_bps").notNull(),
    covidBps: integer("covid_bps").notNull(),
    source: text("source").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.effectiveFrom),
    check(
      "tax_rates",
      sql`${t.vatBps} BETWEEN 0 AND 10000 AND ${t.nhilBps} BETWEEN 0 AND 10000 AND ${t.getfundBps} BETWEEN 0 AND 10000 AND ${t.covidBps} BETWEEN 0 AND 10000`,
    ),
  ],
);
export const auditLog = pgTable(
  "audit_log",
  {
    ...tenant(),
    command: text("command").notNull(),
    actorId: uuid("actor_id"),
    appVersion: text("app_version").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] })],
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
