import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, moneyColumn } from "../base";
import { user, role } from "../auth";
import { customer } from "./base";

export const kycPurposes = ["credit", "role"] as const;
export const kycStatuses = [
  "otp_sent",
  "id_needed",
  "review",
  "approved",
  "rejected",
  "expired",
] as const;
export const kycIdTypes = ["ghana_card", "passport", "voter_id", "drivers_licence"] as const;

/**
 * An identity check for a customer's credit or a member's role. Every ID is verified by hand: the
 * number is kept only masked plus a fingerprint, and the approver ticks that they saw the document.
 */
export const kycCase = pgTable(
  "kyc_case",
  {
    ...tenant(),
    customerId: uuid("customer_id"),
    memberId: uuid("member_id"),
    purpose: text("purpose", { enum: kycPurposes }).notNull(),
    requestedLimit: moneyColumn("requested_limit"),
    requestedRoleId: uuid("requested_role_id"),
    phone: text("phone").notNull(),
    status: text("status", { enum: kycStatuses }).notNull().default("otp_sent"),
    otpDigest: text("otp_digest"),
    otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    otpSends: integer("otp_sends").notNull().default(0),
    idType: text("id_type", { enum: kycIdTypes }),
    idFingerprint: text("id_fingerprint"),
    idMasked: text("id_masked"),
    fullName: text("full_name"),
    idSighted: boolean("id_sighted").notNull().default(false),
    openedBy: uuid("opened_by").notNull(),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    approvedLimit: moneyColumn("approved_limit"),
    approvedRoleId: uuid("approved_role_id"),
    decisionDueAt: timestamp("decision_due_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    uniqueIndex("kyc_case_open_customer")
      .on(t.orgId, t.customerId)
      .where(
        sql`${t.customerId} IS NOT NULL AND ${t.status} IN ('otp_sent', 'id_needed', 'review')`,
      ),
    uniqueIndex("kyc_case_open_member")
      .on(t.orgId, t.memberId)
      .where(sql`${t.memberId} IS NOT NULL AND ${t.status} IN ('otp_sent', 'id_needed', 'review')`),
    foreignKey({ columns: [t.orgId, t.customerId], foreignColumns: [customer.orgId, customer.id] }),
    foreignKey({ columns: [t.orgId, t.memberId], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.requestedRoleId], foreignColumns: [role.orgId, role.id] }),
    foreignKey({ columns: [t.orgId, t.approvedRoleId], foreignColumns: [role.orgId, role.id] }),
    foreignKey({ columns: [t.orgId, t.openedBy], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.decidedBy], foreignColumns: [user.orgId, user.id] }),
    check("kyc_case_purpose", sql`${t.purpose} IN ('credit', 'role')`),
    check(
      "kyc_case_status",
      sql`${t.status} IN ('otp_sent', 'id_needed', 'review', 'approved', 'rejected', 'expired')`,
    ),
    check(
      "kyc_case_id_type",
      sql`${t.idType} IS NULL OR ${t.idType} IN ('ghana_card', 'passport', 'voter_id', 'drivers_licence')`,
    ),
    check("kyc_case_subject", sql`(${t.customerId} IS NULL) <> (${t.memberId} IS NULL)`),
    check(
      "kyc_case_request",
      sql`(${t.purpose} = 'credit' AND ${t.customerId} IS NOT NULL AND ${t.requestedLimit} > 0 AND ${t.requestedRoleId} IS NULL)
        OR (${t.purpose} = 'role' AND ${t.memberId} IS NOT NULL AND ${t.requestedRoleId} IS NOT NULL AND ${t.requestedLimit} IS NULL)`,
    ),
    check(
      "kyc_case_id",
      sql`(${t.idType} IS NULL) = (${t.idFingerprint} IS NULL) AND (${t.idType} IS NULL) = (${t.idMasked} IS NULL)`,
    ),
    check(
      "kyc_case_decision",
      sql`(${t.decidedBy} IS NULL) = (${t.decidedAt} IS NULL) AND (${t.status} NOT IN ('approved', 'rejected') OR ${t.decidedBy} IS NOT NULL)`,
    ),
  ],
);
