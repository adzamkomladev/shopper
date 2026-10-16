import * as v from "valibot";
import { eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { saleDraft, saleDraftLine, type TillDatabase } from "@shopper/db-sqlite";
import { discountDraftInput } from "../../schemas/till/drafts";
import { assertDraftScope, claimDraft } from "./edit";
import { toView } from "./queries";
import { quoteDraft, quoteDraftLine } from "./quote";
import { readQuoteReference } from "../quotation";
import { checkSession } from "../session";
import { assertTenderBalance } from "../tenders/reservation";
import { TillError } from "../error";

export async function setDraftDiscount(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(discountDraftInput, raw);
  assertDraftScope(context, input.scope);
  checkSession(input.session, input.scope, "sale.discount", input.at);
  assertDraftScope(context, { ...input.scope, cashierId: input.session.userId });
  return discount(db, context, input);
}
const discount = defineCommand({
  name: "till.draft.discount",
  async run(tx, _ctx, input: v.InferOutput<typeof discountDraftInput>) {
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    const line = found.lines.find((l) => l.id === input.lineId);
    if (!line) throw new TillError("LINE_UNKNOWN", "Unknown draft line");
    const refs = await readQuoteReference(tx, input.scope.orgId);
    quoteDraftLine(refs, input.scope.branchId, input.at, { ...line, discount: input.discount });
    await tx
      .update(saleDraftLine)
      .set({ discount: input.discount })
      .where(eq(saleDraftLine.id, line.id));
    const lines = found.lines.map((l) =>
      l.id === line.id ? { ...l, discount: input.discount } : l,
    );
    const { totals } = quoteDraft(refs, input.scope.branchId, input.at, lines, found.draft.totals);
    await assertTenderBalance(tx, found.draft.id, totals.gross, refs.cashRounding);
    await tx.update(saleDraft).set({ totals }).where(eq(saleDraft.id, found.draft.id));
    return toView(tx, input.scope, input.at, { draft: { ...found.draft, totals }, lines });
  },
  audit: (input) => ({ lineId: input.lineId, discount: input.discount }),
});
