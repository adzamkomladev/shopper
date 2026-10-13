import { desc, eq } from "drizzle-orm";
import * as v from "valibot";
import { v7 } from "uuid";
import { tillAudit, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import { GENESIS_HASH, hashEntry, redact, type AuditEntry } from "../chain";
import { contextSchema } from "../schemas/command-context";
import type { AuditDetails, CommandContext } from "../types";

export function defineCommand<Input, Output>(
  definition: {
    name: string;
    run: (tx: TillSqlite, context: CommandContext, input: Input) => Promise<Output>;
    audit: (input: Input, output: Output) => Record<string, unknown>;
    details?: (input: Input, output: Output) => AuditDetails;
    replay?: (
      tx: TillSqlite,
      context: CommandContext,
      input: Input,
    ) => Promise<{ output: Output } | undefined>;
  },
  now = Date.now,
) {
  return async (db: TillDatabase, context: CommandContext, input: Input): Promise<Output> => {
    const parsed = v.parse(contextSchema, context);
    context = {
      ...parsed,
      orgId: parsed.orgId.toLowerCase(),
      actorId: parsed.actorId?.toLowerCase(),
      deviceId: parsed.deviceId?.toLowerCase(),
      branchId: parsed.branchId?.toLowerCase(),
      approverId: parsed.approverId?.toLowerCase(),
    };
    if (!definition.name) throw new Error("Commands must have a name");
    return db.transaction(async (tx) => {
      const replay = await definition.replay?.(tx, context, input);
      if (replay) return replay.output;
      const output = await definition.run(tx, context, input);
      const [last] = await tx
        .select()
        .from(tillAudit)
        .where(eq(tillAudit.orgId, context.orgId))
        .orderBy(desc(tillAudit.chainSeq))
        .limit(1);
      const details = definition.details?.(input, output);
      const time = new Date(now());
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
        payload: redact(definition.audit(input, output)) as Record<string, unknown>,
        chainSeq: (last?.chainSeq ?? 0) + 1,
        prevHash: last?.hash ?? GENESIS_HASH,
        hash: null,
        createdAt: time,
        updatedAt: time,
      };
      entry.hash = await hashEntry(entry);
      await tx.insert(tillAudit).values(entry);
      return output;
    });
  };
}
