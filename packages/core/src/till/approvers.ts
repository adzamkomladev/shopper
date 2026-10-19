import { eq } from "drizzle-orm";
import type { TillDatabase } from "@shopper/db-sqlite";
import { defineCommand } from "@shopper/audit/sqlite";
import { tillApprover } from "@shopper/db-sqlite";
import type { ApproverList } from "../schemas/till/approvers";
import { APPROVER_LIST_MS } from "./approvals";

/**
 * Replaces this register's approver list with the server's. A person keeps their failure count unless their PIN
 * hash changed; the audit row never holds a hash.
 */
export const refreshApprovers = defineCommand({
  name: "till.approvers.refresh",
  async run(tx, context, input: ApproverList & { at: Date }) {
    const existing = new Map(
      (await tx.select().from(tillApprover).where(eq(tillApprover.orgId, context.orgId))).map(
        (row) => [row.userId, row],
      ),
    );
    await tx.delete(tillApprover).where(eq(tillApprover.orgId, context.orgId));
    for (const approver of input.approvers) {
      const kept = existing.get(approver.userId);
      const same = kept?.pinHash === approver.pinHash;
      await tx.insert(tillApprover).values({
        ...approver,
        orgId: context.orgId,
        attempts: same ? kept.attempts : 0,
        lockedUntil: same ? kept.lockedUntil : null,
        refreshedAt: input.at.toISOString(),
      });
    }
  },
  audit: (input) => ({
    count: input.approvers.length,
    userIds: input.approvers.map((approver) => approver.userId),
  }),
});

/** Names and ids (never hashes) of who can approve `permission`; `stale` when the list is too old to use offline. */
export async function readApprovers(db: TillDatabase, orgId: string, permission: string, at: Date) {
  const rows = (
    await db.read((tx) => tx.select().from(tillApprover).where(eq(tillApprover.orgId, orgId)))
  ).filter((row) => row.permissions.includes(permission));
  const stale = rows.some((row) => at.valueOf() - Date.parse(row.refreshedAt) > APPROVER_LIST_MS);
  return {
    approvers: stale ? [] : rows.map(({ userId, name }) => ({ userId, name })),
    stale,
  };
}
