import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
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
    slug: text("slug")
      .notNull()
      .default(sql`uuidv7()::text`),
    logo: text("logo"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    mode: text("mode", { enum: ["full", "relay"] })
      .notNull()
      .default("full"),
    ...times(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.slug),
    check("org_mode", sql`${t.mode} IN ('full', 'relay')`),
  ],
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
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
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
    tillAllowed: boolean("till_allowed").notNull().default(false),
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
export const session = pgTable(
  "session",
  {
    ...tenant(),
    userId: uuid("user_id").notNull(),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: uuid("active_organization_id"),
  },
  (t) => [
    unique().on(t.token),
    foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({
      columns: [t.orgId, t.activeOrganizationId],
      foreignColumns: [org.orgId, org.id],
    }),
  ],
);
export const account = pgTable(
  "account",
  {
    ...tenant(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
  },
  (t) => [foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] })],
);
export const verification = pgTable("verification", {
  ...tenant(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const member = pgTable(
  "member",
  {
    ...tenant(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("member"),
    roleId: uuid("role_id").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.organizationId, t.userId),
    foreignKey({ columns: [t.orgId, t.organizationId], foreignColumns: [org.orgId, org.id] }),
    foreignKey({ columns: [t.orgId, t.userId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.roleId], foreignColumns: [role.orgId, role.id] }),
  ],
);
export const invitation = pgTable(
  "invitation",
  {
    ...tenant(),
    organizationId: uuid("organization_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id").notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.orgId, t.organizationId], foreignColumns: [org.orgId, org.id] }),
    foreignKey({ columns: [t.orgId, t.inviterId], foreignColumns: [user.orgId, user.id] }),
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
    role: text("role"),
    deviceId: uuid("device_id"),
    branchId: uuid("branch_id"),
    entity: text("entity"),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    approverId: uuid("approver_id"),
    deviceTime: timestamp("device_time", { withTimezone: true }),
    chainSeq: bigint("chain_seq", { mode: "number" }),
    prevHash: text("prev_hash"),
    hash: text("hash"),
    actorId: uuid("actor_id"),
    appVersion: text("app_version").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.chainSeq),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.approverId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    check(
      "audit_chain_shape",
      sql`(${t.hash} IS NULL AND ${t.prevHash} IS NULL AND ${t.chainSeq} IS NULL) OR (${t.hash} IS NOT NULL AND ${t.prevHash} IS NOT NULL AND ${t.chainSeq} IS NOT NULL AND ${t.hash} ~ '^[0-9a-f]{64}$' AND ${t.prevHash} ~ '^[0-9a-f]{64}$' AND ${t.chainSeq} > 0)`,
    ),
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

export const workflowRun = pgTable(
  "workflow_run",
  {
    ...tenant(),
    instanceId: text("instance_id").notNull(),
    type: text("type").notNull(),
    businessKey: text("business_key").notNull(),
    status: text("status", {
      enum: ["running", "waiting", "completed", "failed", "compensating", "compensated"],
    }).notNull(),
    currentStep: text("current_step").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.instanceId),
    check("workflow_business_key", sql`${t.instanceId} = ${t.businessKey}`),
    check(
      "workflow_status",
      sql`${t.status} IN ('running', 'waiting', 'completed', 'failed', 'compensating', 'compensated')`,
    ),
  ],
);
export const workflowStep = pgTable(
  "workflow_step",
  {
    ...tenant(),
    instanceId: text("instance_id").notNull(),
    name: text("name").notNull(),
    output: jsonb("output").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.instanceId, t.name),
    foreignKey({
      columns: [t.orgId, t.instanceId],
      foreignColumns: [workflowRun.orgId, workflowRun.instanceId],
    }),
    index().on(t.orgId, t.instanceId),
  ],
);
