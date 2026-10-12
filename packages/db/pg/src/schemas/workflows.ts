import { sql } from "drizzle-orm";
import {
  bigint,
  timestamp,
  uuid,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { branch, tenant } from "./base";
import { user } from "./auth";
import { device } from "./devices";

export const workflowRunFields = () => ({
  instanceId: text("instance_id").notNull(),
  type: text("type").notNull(),
  businessKey: text("business_key").notNull(),
  status: text("status", {
    enum: ["running", "waiting", "completed", "failed", "compensating", "compensated"],
  }).notNull(),
  currentStep: text("current_step").notNull(),
});
export const workflowStepFields = () => ({
  instanceId: text("instance_id").notNull(),
  name: text("name").notNull(),
  output: jsonb("output").notNull(),
});

/** Durable workflow state mirrored into PostgreSQL, the record. */
export const workflowRun = pgTable(
  "workflow_run",
  {
    ...tenant(),
    ...workflowRunFields(),
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
    ...workflowStepFields(),
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

/** Audit columns shared by the customer and registration chains; both hash the same projection. */
export const auditFields = () => ({
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
});

export const auditLog = pgTable(
  "audit_log",
  {
    ...tenant(),
    ...auditFields(),
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
