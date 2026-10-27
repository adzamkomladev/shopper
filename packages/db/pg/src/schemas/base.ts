import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  time,
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
export const priceModes = ["inclusive", "exclusive"] as const;
export const statementSchedules = ["off", "monthly"] as const;
export const momoProviders = ["paystack", "hubtel"] as const;
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
    /** The business TIN printed on VAT invoices; the tax settings require it while the org is VAT-registered. */
    tin: text("tin"),
    /** The first day sales carry VAT and levies; null means the org is not VAT-registered. */
    vatRegisteredFrom: date("vat_registered_from"),
    /** Whether shelf prices include tax (the default) or tax is added on top. */
    priceMode: text("price_mode", { enum: priceModes }).notNull().default("inclusive"),
    loyaltyEnabled: boolean("loyalty_enabled").notNull().default(false),
    /** Points earned per 10 000 bps of a sale's value, and what one point is worth. */
    loyaltyEarnBps: integer("loyalty_earn_bps").notNull().default(0),
    loyaltyPointValue: moneyColumn("loyalty_point_value")
      .notNull()
      .default(sql`0`),
    /** Days until earned points lapse; 0 means never. */
    loyaltyExpiryDays: integer("loyalty_expiry_days").notNull().default(0),
    /** Days before a tier downgrade that the customer is told; 0 turns notices off. */
    tierNoticeDays: integer("tier_notice_days").notNull().default(14),
    creditTermsDays: integer("credit_terms_days").notNull().default(30),
    /** Monthly interest on the balance aged past terms; 0 turns interest off. */
    creditInterestBps: integer("credit_interest_bps").notNull().default(0),
    statementSchedule: text("statement_schedule", { enum: statementSchedules })
      .notNull()
      .default("off"),
    statementDay: integer("statement_day").notNull().default(1),
    statementChannels: text("statement_channels")
      .array()
      .notNull()
      .default(sql`'{}'`),
    statementMinBalance: moneyColumn("statement_min_balance")
      .notNull()
      .default(sql`0`),
    kycIdRequired: boolean("kyc_id_required").notNull().default(false),
    kycIdTypes: text("kyc_id_types")
      .array()
      .notNull()
      .default(sql`'{ghana_card,passport,voter_id,drivers_licence}'`),
    /** Who collects the org's till MoMo; each payment snapshots it when it starts. */
    momoProvider: text("momo_provider", { enum: momoProviders }).notNull().default("paystack"),
    ...times(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.slug),
    check("org_mode", sql`${t.mode} IN ('full', 'relay')`),
    check("org_cash_rounding", sql`${t.cashRounding} IN ('none', '10p')`),
    check("org_price_mode", sql`${t.priceMode} IN ('inclusive', 'exclusive')`),
    check(
      "org_loyalty",
      sql`${t.loyaltyEarnBps} BETWEEN 0 AND 10000 AND ${t.loyaltyPointValue} >= 0 AND ${t.loyaltyExpiryDays} >= 0 AND ${t.tierNoticeDays} >= 0 AND (NOT ${t.loyaltyEnabled} OR ${t.loyaltyPointValue} > 0)`,
    ),
    check(
      "org_credit",
      sql`${t.creditTermsDays} >= 0 AND ${t.creditInterestBps} BETWEEN 0 AND 10000`,
    ),
    check(
      "org_statements",
      sql`${t.statementSchedule} IN ('off', 'monthly') AND ${t.statementDay} BETWEEN 1 AND 28 AND ${t.statementChannels} <@ ARRAY['sms', 'email']::text[] AND ${t.statementMinBalance} >= 0 AND (${t.statementSchedule} = 'off' OR cardinality(${t.statementChannels}) > 0)`,
    ),
    check("org_momo_provider", sql`${t.momoProvider} IN ('paystack', 'hubtel')`),
    check(
      "org_kyc",
      sql`${t.kycIdTypes} <@ ARRAY['ghana_card', 'passport', 'voter_id', 'drivers_licence']::text[] AND (NOT ${t.kycIdRequired} OR cardinality(${t.kycIdTypes}) > 0)`,
    ),
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
    /** Trading hours in Accra time (UTC all year): the store-day workflow wakes at each. */
    opensAt: time("opens_at").notNull().default("07:00"),
    closesAt: time("closes_at").notNull().default("21:00"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    check("store_sequence_nonnegative", sql`${t.lastSeq} >= 0`),
    check("positive_cash_rounding_step", sql`${t.cashRoundingStep} > 0`),
    check("store_hours", sql`${t.closesAt} > ${t.opensAt}`),
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
