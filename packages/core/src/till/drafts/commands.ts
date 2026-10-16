import * as v from "valibot";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import {
  saleDraft,
  saleDraftLine,
  type DraftLabel,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import {
  addDraftInput,
  removeDraftLineInput,
  setDraftQuantityInput,
  type DraftScope,
} from "../../schemas/till/drafts";
import { resolveScan } from "../basket/scan";
import { TillError } from "../error";
import { quoteFrom, readQuoteReference } from "../quotation";
import type { DraftView } from "../types";
import { findDraft, toView } from "./queries";
import { assertTenderBalance } from "../tenders/reservation";
import { quoteDraft } from "./quote";

type Line = typeof saleDraftLine.$inferSelect;
type Edit = { scope: DraftScope; expectedRevision: number; at: Date };

export async function addToDraft(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(addDraftInput, raw);
  assertScope(context, input.scope);
  const { scope, at, code } = input;
  if (code !== undefined && input.quantityThousandths !== undefined)
    throw new TillError("QUANTITY_INVALID", "A scanned code carries its own quantity");
  const scanned = code
    ? await resolveScan(db, { orgId: scope.orgId, branchId: scope.branchId, code, at })
    : undefined;
  const label: DraftLabel | undefined =
    scanned?.kind === "weight"
      ? { kind: "weight", code: code! }
      : scanned?.kind === "price"
        ? {
            kind: "price",
            code: code!,
            gross: scanned.gross,
            originalPriceId: scanned.originalPriceId,
            originalQuantityThousandths: scanned.quantityThousandths,
          }
        : undefined;
  return add(db, context, {
    scope,
    at,
    expectedRevision: input.expectedRevision,
    productId: scanned?.productId ?? input.productId!,
    quantityThousandths: scanned?.quantityThousandths ?? input.quantityThousandths ?? 1000,
    label,
  });
}

export async function setDraftQuantity(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(setDraftQuantityInput, raw);
  assertScope(context, input.scope);
  return setQuantity(db, context, input);
}

export async function removeDraftLine(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(removeDraftLineInput, raw);
  assertScope(context, input.scope);
  return remove(db, context, input);
}

const add = defineCommand({
  name: "till.draft.add",
  run: (
    tx,
    context,
    input: Edit & { productId: string; quantityThousandths: number; label?: DraftLabel },
  ) =>
    apply(tx, context, input, async (draftId, lines) => {
      const { productId, quantityThousandths, label } = input;
      // Ordinary scans merge into the line of that product; embedded-label scans stay separate.
      const same = label ? undefined : lines.find((l) => l.productId === productId && !l.label);
      if (same) {
        await tx
          .update(saleDraftLine)
          .set({ quantityThousandths: same.quantityThousandths + quantityThousandths })
          .where(eq(saleDraftLine.id, same.id));
        return same.id;
      }
      const id = v7();
      await tx.insert(saleDraftLine).values({
        id,
        orgId: context.orgId,
        draftId,
        position: Math.max(-1, ...lines.map((l) => l.position)) + 1,
        productId,
        quantityThousandths,
        label: label ?? null,
      });
      return id;
    }),
  audit: (input, output) => ({
    revision: output.draft?.revision,
    productId: input.productId,
    quantityThousandths: input.quantityThousandths,
  }),
  details,
});

const setQuantity = defineCommand({
  name: "till.draft.quantity",
  run: (tx, context, input: Edit & { lineId: string; quantityThousandths: number }) =>
    apply(tx, context, input, async (_draftId, lines) => {
      const line = known(lines, input.lineId);
      await tx
        .update(saleDraftLine)
        .set({ quantityThousandths: input.quantityThousandths })
        .where(eq(saleDraftLine.id, line.id));
      return line.id;
    }),
  audit: (input, output) => ({
    revision: output.draft?.revision,
    lineId: input.lineId,
    quantityThousandths: input.quantityThousandths,
  }),
  details,
});

const remove = defineCommand({
  name: "till.draft.remove",
  run: (tx, context, input: Edit & { lineId: string }) =>
    apply(tx, context, input, async (_draftId, lines) => {
      const line = known(lines, input.lineId);
      await tx.delete(saleDraftLine).where(eq(saleDraftLine.id, line.id));
      return undefined;
    }),
  audit: (input, output) => ({ revision: output.draft?.revision, lineId: input.lineId }),
  details,
});

function details(_input: unknown, output: DraftView) {
  return { entity: "draft", entityId: output.draft?.id };
}

function known(lines: Line[], lineId: string) {
  const line = lines.find((l) => l.id === lineId);
  if (!line) throw new TillError("LINE_UNKNOWN", `Unknown draft line ${lineId}`);
  return line;
}

/** The revision claim makes concurrent basket edits exclusive. */
async function apply(
  tx: TillSqlite,
  context: CommandContext,
  input: Edit,
  change: (draftId: string, lines: Line[]) => Promise<string | undefined>,
): Promise<DraftView> {
  const { scope, expectedRevision, at } = input;
  const found = await findDraft(tx, scope);
  const stale = () =>
    new TillError("REVISION_STALE", `Draft is not at revision ${expectedRevision}`);
  if ((found?.draft.revision ?? 0) !== expectedRevision) throw stale();
  const stamp = at.toISOString();
  let draftId = found?.draft.id;
  if (draftId) {
    const claimed = await tx
      .update(saleDraft)
      .set({ revision: sql`${saleDraft.revision} + 1`, updatedAt: stamp })
      .where(and(eq(saleDraft.id, draftId), eq(saleDraft.revision, expectedRevision)))
      .returning({ id: saleDraft.id });
    if (claimed.length === 0) throw stale();
  } else {
    draftId = v7();
    await tx.insert(saleDraft).values({
      ...scope,
      id: draftId,
      revision: 1,
      totals: {},
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  const touched = await change(draftId, found?.lines ?? []);
  const current = (await findDraft(tx, scope))!;
  const refs = await readQuoteReference(tx, scope.orgId);
  const line = current.lines.find((l) => l.id === touched);
  // Strict for the line being edited: an unknown product or missing price rejects the edit.
  if (line)
    quoteFrom(refs, {
      branchId: scope.branchId,
      at,
      productId: line.productId,
      quantityThousandths: line.quantityThousandths,
    });
  const { totals } = quoteDraft(refs, scope.branchId, at, current.lines, {});
  await assertTenderBalance(tx, draftId, totals.gross, refs.cashRounding);
  await tx.update(saleDraft).set({ totals }).where(eq(saleDraft.id, draftId));
  return toView(tx, scope, at, { ...current, draft: { ...current.draft, totals } });
}

function assertScope(context: CommandContext, scope: DraftScope) {
  const same = (a?: string, b?: string) => a?.toLowerCase() === b;
  if (
    !same(context.orgId, scope.orgId) ||
    !same(context.deviceId, scope.deviceId) ||
    !same(context.branchId, scope.branchId) ||
    !same(context.actorId, scope.cashierId)
  )
    throw new TillError("scope", "Draft scope does not match the command context");
}
