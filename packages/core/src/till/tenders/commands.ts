import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { saleDraftTender, type TillDatabase } from "@shopper/db-sqlite";
import {
  accountTenderInput,
  addDraftTenderInput,
  removeDraftTenderInput,
} from "../../schemas/till/drafts";
import { assertDraftScope, claimDraft } from "../drafts/edit";
import { toView } from "../drafts/queries";
import { TillError } from "../error";
import { readQuoteReference } from "../quotation";
import { quoteDraft } from "../drafts/quote";
import { settle } from "./settle";
import { requireOpenShift } from "../shifts/queries";

export function addDraftTender(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(addDraftTenderInput, raw);
  assertDraftScope(context, input.scope);
  return addTender(db, context, input);
}
export function removeDraftTender(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(removeDraftTenderInput, raw);
  assertDraftScope(context, input.scope);
  return removeTender(db, context, input);
}
/** Puts the account tender the host holds credit for on the basket of the attached customer. */
export function addDraftAccountTender(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(accountTenderInput, raw);
  assertDraftScope(context, input.scope);
  return addAccountTender(db, context, input);
}
const addTender = defineCommand({
  name: "till.draft.tender.add",
  async run(tx, _context, input: v.InferOutput<typeof addDraftTenderInput>) {
    await requireOpenShift(tx, input.scope);
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    if (!found.lines.length) throw new TillError("DRAFT_UNKNOWN", "Cannot tender an empty draft");
    const tenders = await tx
      .select()
      .from(saleDraftTender)
      .where(eq(saleDraftTender.draftId, found.draft.id));
    const refs = await readQuoteReference(tx, input.scope.orgId);
    const quote = quoteDraft(refs, input.scope.branchId, input.at, found.lines, found.draft.totals);
    const reserved = tenders.filter(
      (t) => t.kind !== "momo" || ["pending", "otp", "confirmed"].includes(t.status),
    );
    const settlement = settle(quote.totals.gross, [...reserved, input], refs.cashRounding);
    if (input.amount === 0 && settlement.total !== 0)
      throw new TillError("AMOUNT_INVALID", "Zero cash is only valid for a zero-total sale");
    await tx.insert(saleDraftTender).values({
      id: v7(),
      orgId: input.scope.orgId,
      draftId: found.draft.id,
      position: Math.max(-1, ...tenders.map((t) => t.position)) + 1,
      kind: input.kind,
      amount: input.amount,
      approvalCode: input.kind === "card" ? input.approvalCode : null,
      last4: input.kind === "card" ? input.last4 : null,
      status: "applied",
      createdAt: input.at.toISOString(),
    });
    return toView(tx, input.scope, input.at, found);
  },
  audit: (input) => ({ kind: input.kind, amount: input.amount }),
});
const removeTender = defineCommand({
  name: "till.draft.tender.remove",
  async run(tx, _context, input: v.InferOutput<typeof removeDraftTenderInput>) {
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    const [tender] = await tx
      .select()
      .from(saleDraftTender)
      .where(
        and(eq(saleDraftTender.id, input.tenderId), eq(saleDraftTender.draftId, found.draft.id)),
      );
    if (!tender) throw new TillError("TENDER_UNKNOWN", "Unknown draft tender");
    if (tender.kind === "momo" && tender.status === "confirmed")
      throw new TillError("DRAFT_BUSY", "Confirmed MoMo cannot be removed");
    await tx.delete(saleDraftTender).where(eq(saleDraftTender.id, tender.id));
    return toView(tx, input.scope, input.at, found);
  },
  audit: (input) => ({ tenderId: input.tenderId }),
});
const addAccountTender = defineCommand({
  name: "till.draft.tender.account",
  async run(tx, _context, input: v.InferOutput<typeof accountTenderInput>) {
    await requireOpenShift(tx, input.scope);
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    if (!found.lines.length) throw new TillError("DRAFT_UNKNOWN", "Cannot tender an empty draft");
    if (!found.draft.customerId)
      throw new TillError("CUSTOMER_UNKNOWN", "Attach a customer to sell on account");
    const tenders = await tx
      .select()
      .from(saleDraftTender)
      .where(eq(saleDraftTender.draftId, found.draft.id));
    if (tenders.some((t) => t.kind === input.kind))
      throw new TillError("DRAFT_BUSY", "The basket already has an account tender");
    const refs = await readQuoteReference(tx, input.scope.orgId);
    const quote = quoteDraft(refs, input.scope.branchId, input.at, found.lines, found.draft.totals);
    const reserved = tenders.filter(
      (t) => t.kind !== "momo" || ["pending", "otp", "confirmed"].includes(t.status),
    );
    settle(quote.totals.gross, [...reserved, input], refs.cashRounding);
    await tx.insert(saleDraftTender).values({
      id: input.id,
      orgId: input.scope.orgId,
      draftId: found.draft.id,
      position: Math.max(-1, ...tenders.map((t) => t.position)) + 1,
      kind: input.kind,
      amount: input.amount,
      status: "applied",
      createdAt: input.at.toISOString(),
    });
    return toView(tx, input.scope, input.at, found);
  },
  audit: (input) => ({ tenderId: input.id, kind: input.kind, amount: input.amount }),
});
