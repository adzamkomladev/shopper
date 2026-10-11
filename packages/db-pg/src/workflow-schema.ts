import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, text, unique } from "drizzle-orm/pg-core";
import { tenant } from "./base-schema";

/** Durable workflow state mirrored into PostgreSQL, the record. */
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
