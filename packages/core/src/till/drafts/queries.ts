import * as v from "valibot";
import { and, asc, eq } from "drizzle-orm";
import { saleDraft, saleDraftLine, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import { readDraftInput, type DraftScope } from "../../schemas/till/drafts";
import { readQuoteReference } from "../quotation";
import { quoteDraft } from "./quote";

type Found = {
  draft: typeof saleDraft.$inferSelect;
  lines: (typeof saleDraftLine.$inferSelect)[];
};

/** The requoted open basket of one scope, read-only. A missing draft reads as revision 0 (`draft: null`). */
export async function readDraft(db: TillDatabase, scope: DraftScope, input: { at: Date }) {
  const data = v.parse(readDraftInput, { scope, at: input.at });
  return db.read((tx) => viewDraft(tx, data.scope, data.at));
}

export async function viewDraft(tx: TillSqlite, scope: DraftScope, at: Date) {
  return toView(tx, scope, at, await findDraft(tx, scope));
}

export async function toView(tx: TillSqlite, scope: DraftScope, at: Date, found?: Found) {
  const refs = await readQuoteReference(tx, scope.orgId);
  const quote = quoteDraft(refs, scope.branchId, at, found?.lines ?? [], found?.draft.totals ?? {});
  if (!found) return { draft: null, quote: { ...quote, changed: false } };
  const { draft, lines } = found;
  return {
    draft: {
      id: draft.id,
      revision: draft.revision,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      lines: lines.map(({ id, productId, quantityThousandths, label }) => ({
        id,
        productId,
        quantityThousandths,
        ...(label ? { label } : {}),
      })),
    },
    quote,
  };
}

export async function findDraft(tx: TillSqlite, scope: DraftScope): Promise<Found | undefined> {
  const [draft] = await tx
    .select()
    .from(saleDraft)
    .where(
      and(
        eq(saleDraft.orgId, scope.orgId),
        eq(saleDraft.deviceId, scope.deviceId),
        eq(saleDraft.branchId, scope.branchId),
        eq(saleDraft.cashierId, scope.cashierId),
        eq(saleDraft.status, "open"),
      ),
    );
  if (!draft) return undefined;
  const lines = await tx
    .select()
    .from(saleDraftLine)
    .where(and(eq(saleDraftLine.orgId, scope.orgId), eq(saleDraftLine.draftId, draft.id)))
    .orderBy(asc(saleDraftLine.position));
  return { draft, lines };
}
