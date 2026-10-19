import { useState } from "react";
import { isPriced } from "../../sale/rows";
import type { PriceInput, PricedRow, Row, SaleActions, SaleSnapshot } from "../../sale/types";

/** Alt+O on the selected line: whether it can be repriced, whether a manager must approve, and the dialog. */
export function usePriceOverride(
  snapshot: SaleSnapshot,
  actions: SaleActions,
  selected: Row | undefined,
  disabled: boolean,
) {
  const [open, setOpen] = useState(false);
  const row: PricedRow | undefined = selected && isPriced(selected) ? selected : undefined;
  // A price label already fixes this line's price at the till scale.
  const blocked =
    row?.line.label?.kind === "price" ? "Price-labelled items cannot be overridden" : null;
  const approval = !snapshot.permissions.includes("sale.price_override");

  function ask() {
    if (!row || disabled || blocked || open) return;
    if (approval) actions.loadApprovers("sale.price_override");
    setOpen(true);
  }
  async function submit(input: Omit<PriceInput, "lineId">) {
    const outcome = await actions.priceLine({ lineId: row!.lineId, ...input });
    if (outcome.ok) setOpen(false);
    return outcome;
  }

  return {
    row,
    open,
    approval,
    blocked,
    disabled: disabled || !row || blocked !== null,
    ask,
    setOpen,
    submit,
    retryApprovers: () => actions.loadApprovers("sale.price_override"),
  };
}
