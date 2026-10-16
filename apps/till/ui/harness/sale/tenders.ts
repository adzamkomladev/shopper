import { money, sub, type Money } from "@shopper/money";
import type { DraftTender, DraftView } from "../../src/sale/types";
import { basket, id, items, today } from "../fixtures";

export function withTender(status: DraftTender["status"]): DraftView {
  const view = basket(items.slice(0, 4));
  const tender: DraftTender = {
    id: id("9"),
    orgId: id("2"),
    draftId: id("1"),
    position: 0,
    kind: "momo",
    amount: money(1_265_000),
    reference: id("88"),
    approvalCode: null,
    last4: null,
    phone: "******4567",
    network: "mtn",
    status,
    createdAt: today,
  };
  return {
    ...view,
    draft: view.draft ? { ...view.draft, tenders: [tender] } : null,
    settlement: {
      gross: money(1_265_000),
      roundingLine: money(0),
      total: money(1_265_000),
      nonCash: status === "confirmed" ? money(1_265_000) : money(0),
      cash: money(0),
      balance: status === "confirmed" ? money(0) : money(1_265_000),
      change: money(0),
    },
  };
}

export function withCashTender(amount: Money): DraftView {
  const view = basket(items.slice(0, 4));
  const draft = view.draft;
  if (!draft) return view;
  const tender: DraftTender = {
    id: id("10"),
    orgId: id("2"),
    draftId: draft.id,
    position: 0,
    kind: "cash",
    amount,
    reference: null,
    approvalCode: null,
    last4: null,
    phone: null,
    network: null,
    status: "applied",
    createdAt: today,
  };
  return {
    ...view,
    draft: { ...draft, tenders: [tender] },
    settlement: {
      gross: money(1_265_000),
      roundingLine: money(0),
      total: money(1_265_000),
      nonCash: money(0),
      cash: amount,
      balance: sub(money(1_265_000), amount),
      change: money(0),
    },
  };
}
