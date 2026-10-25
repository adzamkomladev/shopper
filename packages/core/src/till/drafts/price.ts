import * as v from "valibot";
import { eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { saleDraft, saleDraftLine, type TillDatabase } from "@shopper/db-sqlite";
import { priceDraftInput } from "../../schemas/till/drafts";
import { assertDraftScope, claimDraft } from "./edit";
import { toView } from "./queries";
import { quoteDraft, quoteDraftLine } from "./quote";
import { readQuoteReference } from "../quotation";
import { authorize } from "../approvals";
import { assertTenderBalance } from "../tenders/reservation";
import { TillError } from "../error";

/** Replaces one line's unit price. A cashier without `sale.price_override` needs a verified manager (`approverId`). */
export async function setDraftPrice(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(priceDraftInput, raw);
  assertDraftScope(context, input.scope);
  assertDraftScope(context, { ...input.scope, cashierId: input.session.userId });
  const approverId = authorize(
    input.session,
    input.scope,
    "sale.price_override",
    input.at,
    input.approverId,
    !input.session.permissions.includes("sale.price_override"),
  );
  return price(db, { ...context, approverId }, input);
}

const price = defineCommand({
  name: "till.draft.price",
  async run(tx, _ctx, input: v.InferOutput<typeof priceDraftInput>) {
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    const line = found.lines.find((l) => l.id === input.lineId);
    if (!line) throw new TillError("LINE_UNKNOWN", "Unknown draft line");
    if (line.label?.kind === "price")
      throw new TillError("OVERRIDE_INVALID", "A price-labelled line cannot be repriced");
    const refs = await readQuoteReference(tx, input.scope.orgId);
    const listed = quoteDraftLine(refs, input.scope.branchId, input.at, {
      ...line,
      overridePrice: null,
    });
    if (input.unitPrice === listed.tax.unitPrice)
      throw new TillError("OVERRIDE_INVALID", "That is already the list price");
    const override = {
      overridePrice: input.unitPrice,
      overrideReason: input.reason,
      overrideApproverId: input.approverId ?? null,
    };
    quoteDraftLine(refs, input.scope.branchId, input.at, { ...line, ...override });
    await tx.update(saleDraftLine).set(override).where(eq(saleDraftLine.id, line.id));
    const lines = found.lines.map((l) => (l.id === line.id ? { ...l, ...override } : l));
    const { totals } = quoteDraft(refs, input.scope.branchId, input.at, lines, found.draft.totals);
    await assertTenderBalance(tx, found.draft.id, totals.gross, refs.cashRounding);
    await tx.update(saleDraft).set({ totals }).where(eq(saleDraft.id, found.draft.id));
    return toView(tx, input.scope, input.at, { draft: { ...found.draft, totals }, lines });
  },
  audit: (input) => ({ lineId: input.lineId, unitPrice: input.unitPrice, reason: input.reason }),
  // Filed under the product, list price before and override after, so its history shows till overrides too.
  details: (input, view) => {
    const quoted = view.quote.lines.find((line) => line.lineId === input.lineId);
    return {
      entity: "product",
      entityId: view.draft?.lines.find((line) => line.id === input.lineId)?.productId,
      before: { unitPrice: quoted && !quoted.error ? quoted.listPrice : undefined },
      after: { unitPrice: input.unitPrice, reason: input.reason, lineId: input.lineId },
    };
  },
});
