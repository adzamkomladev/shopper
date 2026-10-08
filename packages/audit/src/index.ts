import { and, desc, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { v7 } from "uuid";
import {
  auditLog,
  workflowRun,
  workflowStep,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { GENESIS_HASH, hashEntry, canonicalJson, redact, type AuditEntry } from "./chain";
export * from "./chain";

export interface CommandContext {
  orgId: string;
  actorId?: string;
  role?: string;
  deviceId?: string;
  branchId?: string;
  approverId?: string;
  reason?: string;
  deviceTime?: Date;
  appVersion: string;
}
export interface AuditDetails {
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}
const uuid = v.pipe(
  v.string(),
  v.uuid(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
);
const contextSchema = v.object({
  orgId: uuid,
  actorId: v.optional(uuid),
  role: v.optional(v.string()),
  deviceId: v.optional(uuid),
  branchId: v.optional(uuid),
  approverId: v.optional(uuid),
  reason: v.optional(v.string()),
  deviceTime: v.optional(v.date()),
  appVersion: v.pipe(v.string(), v.minLength(1)),
});

export interface WorkflowCheckpoint {
  instanceId: string;
  businessKey: string;
  type: string;
  step: string;
  status: typeof workflowRun.$inferSelect.status;
}
export function defineCommand<Input, Output>(definition: {
  name: string;
  run: (tx: ShopperTransaction, context: CommandContext, input: Input) => Promise<Output>;
  audit: (input: Input, output: Output) => Record<string, unknown>;
  details?: (input: Input, output: Output) => AuditDetails;
}) {
  return async (
    db: ShopperDatabase,
    context: CommandContext,
    input: Input,
    checkpoint?: WorkflowCheckpoint,
  ): Promise<Output> => {
    context = v.parse(contextSchema, context);
    // PostgreSQL normalizes UUID text; hash and lock the same representation.
    context = {
      ...context,
      orgId: context.orgId.toLowerCase(),
      actorId: context.actorId?.toLowerCase(),
      deviceId: context.deviceId?.toLowerCase(),
      branchId: context.branchId?.toLowerCase(),
      approverId: context.approverId?.toLowerCase(),
    };
    if (!definition.name) throw new Error("Commands must have a name");
    if (
      checkpoint &&
      (checkpoint.instanceId !== checkpoint.businessKey || !checkpoint.step || !checkpoint.type)
    ) {
      throw new Error("Workflow instance id must be its business key, with a type and named step");
    }
    return db.transaction(async (tx) => {
      // Serialize the whole command, before business locks, to prevent forks and lock inversions.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${context.orgId}, 0))`);
      if (checkpoint) {
        const [run] = await tx
          .select()
          .from(workflowRun)
          .where(
            and(
              eq(workflowRun.orgId, context.orgId),
              eq(workflowRun.instanceId, checkpoint.instanceId),
            ),
          );
        if (run && run.type !== checkpoint.type)
          throw new Error("Workflow business key already belongs to another type");
        const [saved] = await tx
          .select()
          .from(workflowStep)
          .where(
            and(
              eq(workflowStep.orgId, context.orgId),
              eq(workflowStep.instanceId, checkpoint.instanceId),
              eq(workflowStep.name, checkpoint.step),
            ),
          );
        if (saved) return saved.output as Output;
      }
      const output = await definition.run(tx, context, input);
      if (checkpoint) {
        // Workflow outputs must be JSON; checkpoint replay returns the same value after restart.
        canonicalJson(output);
        await tx
          .insert(workflowRun)
          .values({
            orgId: context.orgId,
            instanceId: checkpoint.instanceId,
            businessKey: checkpoint.businessKey,
            type: checkpoint.type,
            currentStep: checkpoint.step,
            status: checkpoint.status,
          })
          .onConflictDoUpdate({
            target: [workflowRun.orgId, workflowRun.instanceId],
            set: { currentStep: checkpoint.step, status: checkpoint.status },
          });
        await tx.insert(workflowStep).values({
          orgId: context.orgId,
          instanceId: checkpoint.instanceId,
          name: checkpoint.step,
          output,
        });
      }
      const [last] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.orgId, context.orgId), sql`${auditLog.chainSeq} IS NOT NULL`))
        .orderBy(desc(auditLog.chainSeq))
        .limit(1);
      const details = definition.details?.(input, output);
      const [{ time }] = (
        await tx.execute<{ time: string }>(sql`SELECT clock_timestamp()::text AS time`)
      ).rows;
      const entry: AuditEntry = {
        id: v7(),
        orgId: context.orgId,
        actorId: context.actorId ?? null,
        role: context.role ?? null,
        deviceId: context.deviceId ?? null,
        branchId: context.branchId ?? null,
        approverId: context.approverId ?? null,
        reason: context.reason ?? null,
        deviceTime: context.deviceTime ?? null,
        entity: details?.entity ?? null,
        entityId: details?.entityId?.toLowerCase() ?? null,
        before: redact(details?.before ?? null),
        after: redact(details?.after ?? null),
        appVersion: context.appVersion,
        command: definition.name,
        payload: redact({
          ...definition.audit(input, output),
          ...(checkpoint ? { workflow: checkpoint } : {}),
        }) as Record<string, unknown>,
        chainSeq: (last?.chainSeq ?? 0) + 1,
        prevHash: last?.hash ?? GENESIS_HASH,
        hash: null,
        createdAt: new Date(time!),
        updatedAt: new Date(time!),
      };
      entry.hash = await hashEntry(entry);
      await tx.insert(auditLog).values(entry);
      return output;
    });
  };
}
