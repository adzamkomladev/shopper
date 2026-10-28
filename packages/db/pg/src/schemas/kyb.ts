import { sql } from "drizzle-orm";
import { check, date, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { tenant } from "./base";

export const kybStatuses = [
  "draft",
  "submitted",
  "checks_failed",
  "in_review",
  "approved",
  "rejected",
  "expired",
] as const;

/** A director's identity as submitted: the Ghana Card and the asset holding its scan. */
export type KybDirector = {
  name: string;
  ghanaCard: string;
  cardExpiresOn: string;
  cardAssetId: string;
};
export type KybDocument = {
  kind: "registration_certificate" | "tin_certificate";
  assetId: string;
  expiresOn: string | null;
};
export type KybCheck = { check: string; ok: boolean; reason?: string };

/**
 * One business verification per shop, so Shopper may pay out its MoMo collections. The row is the record the
 * workflow reads; `version` counts submissions, so checks and decisions apply only to the one they were made for.
 * Directors and documents are a snapshot reviewed as a whole, so they live on the case.
 */
export const kybCase = pgTable(
  "kyb_case",
  {
    ...tenant(),
    status: text("status", { enum: kybStatuses }).notNull().default("draft"),
    businessName: text("business_name"),
    registrationNumber: text("registration_number"),
    tin: text("tin"),
    /** A Paystack GHS settlement bank or mobile money code. */
    settlementBank: text("settlement_bank"),
    settlementAccount: text("settlement_account"),
    directors: jsonb("directors").$type<KybDirector[]>().notNull().default([]),
    documents: jsonb("documents").$type<KybDocument[]>().notNull().default([]),
    checks: jsonb("checks").$type<KybCheck[]>().notNull().default([]),
    version: integer("version").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** The earliest card or document expiry at submission: approval lapses then. */
    expiresOn: date("expires_on"),
    reviewerId: text("reviewer_id"),
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    renewalSentAt: timestamp("renewal_sent_at", { withTimezone: true }),
    subaccountCode: text("subaccount_code"),
  },
  (t) => [
    unique().on(t.orgId),
    check(
      "kyb_case_status",
      sql`${t.status} IN ('draft', 'submitted', 'checks_failed', 'in_review', 'approved', 'rejected', 'expired')`,
    ),
    check("kyb_case_version", sql`${t.version} >= 0`),
    check(
      "kyb_case_decided",
      sql`(${t.status} IN ('approved', 'rejected', 'expired')) = (${t.decidedAt} IS NOT NULL)`,
    ),
  ],
);
