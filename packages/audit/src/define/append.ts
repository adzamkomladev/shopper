import { and, desc, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { auditLog, registrationAuditLog, type ShopperTransaction } from "@shopper/db-pg";
import { GENESIS_HASH, hashEntry, redact, type AuditEntry } from "../chain";
import type { AuditDetails, CommandContext } from "../types";

/**
 * Adds one row to the audit chain inside the caller's transaction. `defineCommand` holds the org's chain lock
 * for the whole command, so a command may append a second row for a side effect it caused (a sale that
 * created its customer) without forking the chain.
 */
export async function appendAudit(
  tx: ShopperTransaction,
  audit: typeof auditLog | typeof registrationAuditLog,
  context: CommandContext,
  row: { command: string; details?: AuditDetails; payload: Record<string, unknown> },
) {
  const { details } = row;
  const clock = sql<string>`clock_timestamp()::text`;
  const [last] = await tx
    .select({ chainSeq: audit.chainSeq, hash: audit.hash, time: clock })
    .from(audit)
    .where(and(eq(audit.orgId, context.orgId), sql`${audit.chainSeq} IS NOT NULL`))
    .orderBy(desc(audit.chainSeq))
    .limit(1);
  // The chain head carries the clock; only an org's first row needs its own read.
  const time =
    last?.time ?? (await tx.execute<{ time: string }>(sql`SELECT ${clock} AS time`)).rows[0]!.time;
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
    command: row.command,
    payload: redact(row.payload) as Record<string, unknown>,
    chainSeq: (last?.chainSeq ?? 0) + 1,
    prevHash: last?.hash ?? GENESIS_HASH,
    hash: null,
    createdAt: new Date(time),
    updatedAt: new Date(time),
  };
  entry.hash = await hashEntry(entry);
  await tx.insert(audit).values(entry);
}

/** The tenant chain's `appendAudit`, for a side effect of a command already running. */
export const appendTenantAudit = (
  tx: ShopperTransaction,
  context: CommandContext,
  row: Parameters<typeof appendAudit>[3],
) => appendAudit(tx, auditLog, context, row);
