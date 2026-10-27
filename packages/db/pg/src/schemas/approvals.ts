import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { Money } from "@shopper/money";
import { tenant, branch } from "./base";
import { user } from "./auth";
import { device } from "./devices";

export const approvalKinds = ["refund", "discount"] as const;
export const approvalStatuses = ["pending", "approved", "declined", "expired"] as const;

/** What the manager saw and agreed to; the refund or discount that uses the approval must match it. */
export type ApprovalSubject = {
  saleId?: string;
  receiptNumber?: string;
  amount: Money;
  reason: string;
};

/** A cashier asking a manager who is not at the register. The id is also the approval workflow's instance. */
export const approvalRequest = pgTable(
  "approval_request",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    requestedBy: uuid("requested_by").notNull(),
    kind: text("kind", { enum: approvalKinds }).notNull(),
    subject: jsonb("subject").$type<ApprovalSubject>().notNull(),
    status: text("status", { enum: approvalStatuses }).notNull().default("pending"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set in the transaction that accepts the refund or discount, so one approval is used once. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    /** The refund or sale that used it, so a replayed upload of that same document is not a second use. */
    consumedBy: uuid("consumed_by"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("approval_request_status").on(t.orgId, t.status),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.requestedBy], foreignColumns: [user.orgId, user.id] }),
    foreignKey({ columns: [t.orgId, t.decidedBy], foreignColumns: [user.orgId, user.id] }),
    check("approval_request_kind", sql`${t.kind} IN ('refund', 'discount')`),
    check(
      "approval_request_status",
      sql`${t.status} IN ('pending', 'approved', 'declined', 'expired')`,
    ),
    check(
      "approval_request_decision",
      sql`(${t.status} IN ('approved', 'declined')) = (${t.decidedBy} IS NOT NULL AND ${t.decidedAt} IS NOT NULL)`,
    ),
  ],
);
