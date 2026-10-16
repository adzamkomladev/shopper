import { and, eq, sql } from "drizzle-orm";
import type { CommandContext } from "@shopper/audit/sqlite";
import { saleDraft, saleDraftLine, type TillSqlite } from "@shopper/db-sqlite";
import type { DraftScope } from "../../schemas/till/drafts";
import { TillError } from "../error";
import { findDraft } from "./queries";

export function assertDraftScope(context: CommandContext, scope: DraftScope) {
  if (
    context.orgId?.toLowerCase() !== scope.orgId ||
    context.deviceId?.toLowerCase() !== scope.deviceId ||
    context.branchId?.toLowerCase() !== scope.branchId ||
    context.actorId?.toLowerCase() !== scope.cashierId
  )
    throw new TillError("scope", "Draft scope does not match the command context");
}

export async function claimDraft(
  tx: TillSqlite,
  scope: DraftScope,
  expectedRevision: number,
  at: Date,
  draftId?: string,
) {
  let found = await findDraft(tx, scope);
  if (draftId) {
    const [draft] = await tx
      .select()
      .from(saleDraft)
      .where(
        and(
          eq(saleDraft.id, draftId),
          eq(saleDraft.orgId, scope.orgId),
          eq(saleDraft.deviceId, scope.deviceId),
          eq(saleDraft.branchId, scope.branchId),
          eq(saleDraft.cashierId, scope.cashierId),
          eq(saleDraft.status, "held"),
        ),
      );
    found = draft
      ? {
          draft,
          lines: await tx
            .select()
            .from(saleDraftLine)
            .where(eq(saleDraftLine.draftId, draft.id))
            .orderBy(saleDraftLine.position),
        }
      : undefined;
  }
  if (!found) throw new TillError("DRAFT_UNKNOWN", "No open draft");
  const claimed = await tx
    .update(saleDraft)
    .set({ revision: sql`${saleDraft.revision} + 1`, updatedAt: at.toISOString() })
    .where(and(eq(saleDraft.id, found.draft.id), eq(saleDraft.revision, expectedRevision)))
    .returning();
  const [draft] = claimed;
  if (!draft) throw new TillError("REVISION_STALE", `Draft is not at revision ${expectedRevision}`);
  return { ...found, draft };
}
