import * as v from "valibot";
import { and, eq, sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import {
  saleDraft,
  saleDraftLine,
  saleDraftTender,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import {
  holdDraftInput,
  resumeDraftInput,
  voidDraftInput,
  readDraftInput,
  type DraftScope,
} from "../../schemas/till/drafts";
import { assertDraftScope, claimDraft } from "./edit";
import { findDraft, toView } from "./queries";
import { checkSession } from "../session";
import { TillError } from "../error";

export function holdDraftSale(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(holdDraftInput, raw);
  assertDraftScope(context, input.scope);
  return hold(db, context, input);
}
export function resumeDraftSale(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(resumeDraftInput, raw);
  assertDraftScope(context, input.scope);
  return resume(db, context, input);
}
export async function voidDraftSale(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(voidDraftInput, raw);
  assertDraftScope(context, input.scope);
  checkSession(input.session, input.scope, "sale.void", input.at);
  assertDraftScope(context, { ...input.scope, cashierId: input.session.userId });
  return voidSale(db, { ...context, reason: input.reason }, input);
}
export async function listHeldDraftSales(db: TillDatabase, scope: DraftScope, input: { at: Date }) {
  const data = v.parse(readDraftInput, { scope, ...input });
  return db.read(async (tx) => {
    const drafts = await tx
      .select()
      .from(saleDraft)
      .where(and(...scopeConditions(data.scope), eq(saleDraft.status, "held")))
      .orderBy(saleDraft.heldAt);
    return Promise.all(
      drafts.map(async (draft) => {
        const lines = await tx
          .select()
          .from(saleDraftLine)
          .where(eq(saleDraftLine.draftId, draft.id))
          .orderBy(saleDraftLine.position);
        return toView(tx, data.scope, data.at, { draft, lines });
      }),
    );
  });
}
const hold = defineCommand({
  name: "till.draft.hold",
  async run(tx, _ctx, input: v.InferOutput<typeof holdDraftInput>) {
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    await assertPayments(tx, found.draft.id, true);
    if (!found.lines.length) throw new TillError("DRAFT_UNKNOWN", "Cannot hold an empty draft");
    const [draft] = await tx
      .update(saleDraft)
      .set({ status: "held", name: input.name ?? null, heldAt: input.at.toISOString() })
      .where(eq(saleDraft.id, found.draft.id))
      .returning();
    return toView(tx, input.scope, input.at, { ...found, draft: draft ?? found.draft });
  },
  audit: (input) => ({ name: input.name ?? null }),
});
const resume = defineCommand({
  name: "till.draft.resume",
  async run(tx, _ctx, input: v.InferOutput<typeof resumeDraftInput>) {
    const [held] = await tx
      .select()
      .from(saleDraft)
      .where(
        and(
          ...scopeConditions(input.scope),
          eq(saleDraft.id, input.draftId),
          eq(saleDraft.status, "held"),
        ),
      );
    if (!held) throw new TillError("DRAFT_UNKNOWN", "Unknown held draft");
    const open = await findDraft(tx, input.scope);
    if (open?.lines.length)
      throw new TillError("DRAFT_BUSY", "The open draft must be empty before resuming");
    if (open) {
      await assertPayments(tx, open.draft.id, true);
      await tx.delete(saleDraftTender).where(eq(saleDraftTender.draftId, open.draft.id));
      await tx.delete(saleDraft).where(eq(saleDraft.id, open.draft.id));
    }
    const [draft] = await tx
      .update(saleDraft)
      .set({
        status: "open",
        revision: sql`${saleDraft.revision} + 1`,
        heldAt: null,
        updatedAt: input.at.toISOString(),
      })
      .where(and(eq(saleDraft.id, held.id), eq(saleDraft.revision, input.expectedRevision)))
      .returning();
    if (!draft) throw new TillError("REVISION_STALE", "Held draft revision changed");
    const lines = await tx
      .select()
      .from(saleDraftLine)
      .where(eq(saleDraftLine.draftId, draft.id))
      .orderBy(saleDraftLine.position);
    return toView(tx, input.scope, input.at, { draft, lines });
  },
  audit: (input) => ({ draftId: input.draftId }),
});
const voidSale = defineCommand({
  name: "till.draft.void",
  async run(tx, _ctx, input: v.InferOutput<typeof voidDraftInput>) {
    const found = await claimDraft(
      tx,
      input.scope,
      input.expectedRevision,
      input.at,
      input.draftId,
    );
    await assertPayments(tx, found.draft.id, false);
    const [draft] = await tx
      .update(saleDraft)
      .set({ status: "voided", voidReason: input.reason, voidedAt: input.at.toISOString() })
      .where(eq(saleDraft.id, found.draft.id))
      .returning();
    return toView(tx, input.scope, input.at, { ...found, draft: draft ?? found.draft });
  },
  audit: (input) => ({ reason: input.reason }),
});
function scopeConditions(scope: DraftScope) {
  return [
    eq(saleDraft.orgId, scope.orgId),
    eq(saleDraft.deviceId, scope.deviceId),
    eq(saleDraft.branchId, scope.branchId),
    eq(saleDraft.cashierId, scope.cashierId),
  ];
}
async function assertPayments(tx: TillSqlite, draftId: string, pending: boolean) {
  const tenders = await tx
    .select()
    .from(saleDraftTender)
    .where(eq(saleDraftTender.draftId, draftId));
  if (
    tenders.some(
      (t) =>
        t.kind === "momo" &&
        (t.status === "confirmed" || (pending && (t.status === "pending" || t.status === "otp"))),
    )
  )
    throw new TillError("DRAFT_BUSY", "The draft has an active MoMo payment");
}
