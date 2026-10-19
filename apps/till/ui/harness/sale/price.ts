import type { DraftView, PriceInput } from "../../src/sale/types";
import { basket, items } from "../fixtures";

/** The basket after a price override: the priced line quotes at the new price and keeps its list price. */
export function priceView({ lineId, unitPrice }: PriceInput): DraftView {
  return basket(
    items
      .slice(0, 4)
      .map((spec) =>
        spec.id === lineId ? { ...spec, unitPrice, listPrice: spec.unitPrice } : spec,
      ),
  );
}
