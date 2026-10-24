import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, moneyColumn } from "../base";
import { device } from "../devices";

export const customerKinds = ["individual", "business"] as const;

/** A person or business that buys at the tills. What they owe and hold is never stored here: the ledgers fold to it. */
export const customer = pgTable(
  "customer",
  {
    ...tenant(),
    name: text("name").notNull(),
    /** 0XXXXXXXXX. Not unique: a lookup lists every match and a merge fixes the duplicates. */
    phone: text("phone").notNull(),
    kind: text("kind", { enum: customerKinds }).notNull().default("individual"),
    businessName: text("business_name"),
    tin: text("tin"),
    email: text("email"),
    creditLimit: moneyColumn("credit_limit")
      .notNull()
      .default(sql`0`),
    kycVerifiedAt: timestamp("kyc_verified_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    mergedIntoId: uuid("merged_into_id"),
    createdDeviceId: uuid("created_device_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("customer_phone").on(t.orgId, t.phone),
    index("customer_name").on(t.orgId, sql`lower(${t.name})`),
    foreignKey({
      columns: [t.orgId, t.mergedIntoId],
      foreignColumns: [t.orgId, t.id],
      name: "customer_org_id_merged_into_id_customer_org_id_id_fk",
    }),
    foreignKey({
      columns: [t.orgId, t.createdDeviceId],
      foreignColumns: [device.orgId, device.id],
    }),
    check("customer_kind", sql`${t.kind} IN ('individual', 'business')`),
    check("customer_phone", sql`${t.phone} ~ '^0[0-9]{9}$'`),
    check(
      "customer_business",
      sql`${t.kind} <> 'business' OR (${t.businessName} IS NOT NULL AND ${t.businessName} <> '')`,
    ),
    check(
      "customer_tin",
      sql`${t.tin} IS NULL OR ${t.tin} ~ '^(?:[A-Z][0-9]{10}|GHA-[0-9]{9}-[0-9])$'`,
    ),
    check("customer_credit_limit", sql`${t.creditLimit} >= 0`),
    check("customer_credit_kyc", sql`${t.creditLimit} = 0 OR ${t.kycVerifiedAt} IS NOT NULL`),
    check("customer_merged", sql`${t.mergedIntoId} IS NULL OR ${t.archivedAt} IS NOT NULL`),
    check("customer_version_positive", sql`${t.version} > 0`),
  ],
);
