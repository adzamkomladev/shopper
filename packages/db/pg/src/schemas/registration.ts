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
import { tenant } from "./base";
import { auditFields, workflowRunFields, workflowStepFields } from "./workflows";

// Pre-shop storage: the candidate id reserves the future org id without a customer org row.
const { id, createdAt, updatedAt } = tenant();
export const registrationRequest = pgTable(
  "registration_request",
  {
    id,
    orgId: uuid("org_id")
      .notNull()
      .generatedAlwaysAs(sql`id`),
    createdAt,
    updatedAt,
    email: text("email").notNull(),
    name: text("name").notNull(),
    shopName: text("shop_name").notNull(),
    shopCode: text("shop_code").notNull(),
    verificationDigest: text("verification_digest").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    result: jsonb("result").$type<Record<string, unknown>>(),
  },
  (t) => [index().on(t.email)],
);
// Same columns as tenant() but the org reference points at the request, not a customer org.
const registrationTenant = () => {
  const { orgId: _orgId, ...columns } = tenant();
  return {
    ...columns,
    orgId: uuid("org_id")
      .notNull()
      .references(() => registrationRequest.id),
  };
};

export const registrationWorkflowRun = pgTable(
  "registration_workflow_run",
  {
    ...registrationTenant(),
    ...workflowRunFields(),
  },
  (t) => [
    unique().on(t.orgId, t.instanceId),
    check("registration_workflow_business_key", sql`${t.instanceId} = ${t.businessKey}`),
    check(
      "registration_workflow_status",
      sql`${t.status} IN ('running', 'waiting', 'completed', 'failed', 'compensating', 'compensated')`,
    ),
  ],
);
export const registrationWorkflowStep = pgTable(
  "registration_workflow_step",
  {
    ...registrationTenant(),
    ...workflowStepFields(),
  },
  (t) => [
    unique().on(t.orgId, t.instanceId, t.name),
    foreignKey({
      columns: [t.orgId, t.instanceId],
      foreignColumns: [registrationWorkflowRun.orgId, registrationWorkflowRun.instanceId],
    }),
    index().on(t.orgId, t.instanceId),
  ],
);
// actor, approver, device and branch stay plain columns: no customer identity exists yet.
export const registrationAuditLog = pgTable(
  "registration_audit_log",
  {
    ...registrationTenant(),
    ...auditFields(),
  },
  (t) => [
    unique().on(t.orgId, t.chainSeq),
    check(
      "registration_audit_chain_shape",
      sql`${t.hash} IS NOT NULL AND ${t.prevHash} IS NOT NULL AND ${t.chainSeq} IS NOT NULL AND ${t.hash} ~ '^[0-9a-f]{64}$' AND ${t.prevHash} ~ '^[0-9a-f]{64}$' AND ${t.chainSeq} > 0`,
    ),
  ],
);
