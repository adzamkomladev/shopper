import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLog, type ShopperTransaction } from "@shopper/db-pg";
import type { fieldsOf } from "./commands";

type Fields = ReturnType<typeof fieldsOf>;
const HISTORY = ["customer.update", "customer.till.update"];

/**
 * The till's fields that nobody wrote after it did. The history is every edit since the version the till saw; a
 * field takes the time of its latest writer, which for a till is when the cashier acted, not when it uploaded.
 */
export async function laterThanServer(
  tx: ShopperTransaction,
  orgId: string,
  edit: { id: string; baseVersion: number; changes: Record<string, unknown> },
  occurredAt: Date,
) {
  const { id, baseVersion, changes } = edit;
  const history = await tx
    .select({
      before: auditLog.before,
      after: auditLog.after,
      payload: auditLog.payload,
      at: auditLog.createdAt,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, orgId),
        eq(auditLog.entity, "customer"),
        eq(auditLog.entityId, id),
        inArray(auditLog.command, HISTORY),
        sql`(${auditLog.payload}->>'version')::int > ${baseVersion}`,
      ),
    );
  const lastWrite = (field: keyof Fields) =>
    Math.max(
      -Infinity,
      ...history
        .filter((row) => (row.before as Fields)[field] !== (row.after as Fields)[field])
        .map((row) =>
          Date.parse((row.payload.occurredAt as string | undefined) ?? row.at.toISOString()),
        ),
    );
  return Object.fromEntries(
    Object.entries(changes).filter(
      ([field]) => lastWrite(field as keyof Fields) <= occurredAt.valueOf(),
    ),
  );
}
