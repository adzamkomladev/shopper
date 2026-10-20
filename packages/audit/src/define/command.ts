import { and, desc, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import type { Envelope } from "@shopper/ports";
import { v7 } from "uuid";
import {
  auditLog,
  registrationAuditLog,
  registrationWorkflowRun,
  registrationWorkflowStep,
  workflowRun,
  workflowStep,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { GENESIS_HASH, hashEntry, canonicalJson, redact, type AuditEntry } from "../chain";
import { contextSchema, registrationContextSchema } from "../schemas/command/context";
import { collectEnvelopes, collectStoreChanges } from "../notifications";
import type { AuditDetails, CommandContext, WorkflowCheckpoint } from "../types";

// Fixed internal table sets: a command's scope picks its chain, never the caller. The registration
// tables share the customer columns, so the queries below run unchanged on either set.
const storage = {
  tenant: { schema: contextSchema, audit: auditLog, run: workflowRun, step: workflowStep },
  registration: {
    schema: registrationContextSchema,
    audit: registrationAuditLog,
    run: registrationWorkflowRun,
    step: registrationWorkflowStep,
  },
};

export function defineCommand<Input, Output>(definition: {
  name: string;
  /** Trusted, definition-level choice; defaults to the customer tenant chain. */
  scope?: "registration";
  run: (tx: ShopperTransaction, context: CommandContext, input: Input) => Promise<Output>;
  replay?: (
    tx: ShopperTransaction,
    context: CommandContext,
    input: Input,
  ) => Promise<{ output: Output } | undefined>;
  audit: (input: Input, output: Output) => Record<string, unknown>;
  details?: (input: Input, output: Output) => AuditDetails;
}) {
  const { schema, audit, run: runs, step: steps } = storage[definition.scope ?? "tenant"];
  return async (
    db: ShopperDatabase,
    context: CommandContext,
    input: Input,
    checkpoint?: WorkflowCheckpoint,
  ): Promise<Output> => {
    // The parse below strips keys the schema does not know, so take the callbacks first.
    const { onStoreChanged, queue } = context;
    const heads = new Map<string, string>();
    const queued: Envelope[] = [];
    context = v.parse(schema, context) as CommandContext;
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
    const result = await db.transaction(async (tx) => {
      collectStoreChanges(tx, heads);
      collectEnvelopes(tx, queued);
      // Serialize the whole command, before business locks, to prevent forks and lock inversions.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${context.orgId}, 0))`);
      if (checkpoint) {
        const [run] = await tx
          .select()
          .from(runs)
          .where(and(eq(runs.orgId, context.orgId), eq(runs.instanceId, checkpoint.instanceId)));
        if (run && run.type !== checkpoint.type)
          throw new Error("Workflow business key already belongs to another type");
        const [saved] = await tx
          .select()
          .from(steps)
          .where(
            and(
              eq(steps.orgId, context.orgId),
              eq(steps.instanceId, checkpoint.instanceId),
              eq(steps.name, checkpoint.step),
            ),
          );
        if (saved) return saved.output as Output;
      }
      const replay = checkpoint ? undefined : await definition.replay?.(tx, context, input);
      if (replay) return replay.output;
      const output = await definition.run(tx, context, input);
      if (checkpoint) {
        // Workflow outputs must be JSON; checkpoint replay returns the same value after restart.
        canonicalJson(output);
        await tx
          .insert(runs)
          .values({
            orgId: context.orgId,
            instanceId: checkpoint.instanceId,
            businessKey: checkpoint.businessKey,
            type: checkpoint.type,
            currentStep: checkpoint.step,
            status: checkpoint.status,
          })
          .onConflictDoUpdate({
            target: [runs.orgId, runs.instanceId],
            set: { currentStep: checkpoint.step, status: checkpoint.status },
          });
        await tx.insert(steps).values({
          orgId: context.orgId,
          instanceId: checkpoint.instanceId,
          name: checkpoint.step,
          output,
        });
      }
      const [last] = await tx
        .select()
        .from(audit)
        .where(and(eq(audit.orgId, context.orgId), sql`${audit.chainSeq} IS NOT NULL`))
        .orderBy(desc(audit.chainSeq))
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
      await tx.insert(audit).values(entry);
      return output;
    });
    for (const [storeId, sequence] of heads) {
      try {
        await onStoreChanged?.(storeId, sequence);
      } catch (error) {
        console.error({ event: "realtime.publish_failed", orgId: context.orgId, storeId, error });
      }
    }
    for (const envelope of queued) {
      try {
        await queue?.send(envelope);
      } catch (error) {
        console.error({ event: "queue.send_failed", orgId: context.orgId, id: envelope.id, error });
      }
    }
    return result;
  };
}
