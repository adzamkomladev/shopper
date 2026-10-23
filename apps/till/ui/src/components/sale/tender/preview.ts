import { settle } from "@shopper/core/till/settlement";
import type { Money } from "@shopper/money";
import type { TenderMethod } from "../../../sale/account/types";
import type { SaleSnapshot } from "../../../sale/types";

export function previewSettlement(
  view: SaleSnapshot["view"],
  gross: Money,
  selectedKind: TenderMethod,
) {
  const draft = view?.draft;
  if (!draft || view.settlementError) return undefined;
  const tenders = draft.tenders
    .filter((tender) => tender.status === "applied" || tender.status === "confirmed")
    .map(({ kind, amount }) => ({ kind, amount }));
  return settle(
    gross,
    tenders,
    view.cashRounding ?? "none",
    selectedKind === "cash" ? "cash" : undefined,
  );
}
