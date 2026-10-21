import { useState } from "react";
import { lineErrors, lineId, SEARCH_ID } from "../../../lib/inventory/entry";
import type { DraftLine, LineErrors, LineField } from "../../../lib/inventory/types";

type Product = Pick<DraftLine, "productId" | "sku" | "name" | "baseUnit">;

/** The products being typed onto a receipt or adjustment, and what is wrong with each. */
export function useDraftLines(costed: boolean) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [errors, setErrors] = useState<LineErrors>({});
  return {
    lines,
    errors,
    /** A product already on the list is not added twice: its quantity takes focus. */
    add({ productId, sku, name, baseUnit }: Product) {
      if (lines.some((line) => line.productId === productId))
        return document.getElementById(lineId(productId, "quantity"))?.focus();
      setLines([...lines, { productId, sku, name, baseUnit, quantity: "", cost: "" }]);
    },
    edit(productId: string, field: LineField, value: string) {
      setErrors((previous) => ({
        ...previous,
        [productId]: { ...previous[productId], [field]: undefined },
      }));
      setLines(
        lines.map((line) => (line.productId === productId ? { ...line, [field]: value } : line)),
      );
    },
    /** Focus moves on before the line goes: to the next line's quantity, or to the search when it was the last. */
    remove: (productId: string) => {
      const next = lines[lines.findIndex((line) => line.productId === productId) + 1];
      document.getElementById(next ? lineId(next.productId, "quantity") : SEARCH_ID)?.focus();
      setLines(lines.filter((line) => line.productId !== productId));
    },
    /** Marks every bad line and moves focus to the first bad field. Returns whether all lines are fine. */
    validate() {
      const found = lineErrors(lines, costed);
      setErrors(found);
      const first = lines.find((line) => found[line.productId]);
      if (first)
        document
          .getElementById(
            lineId(first.productId, found[first.productId]!.quantity ? "quantity" : "cost"),
          )
          ?.focus();
      return !first;
    },
  };
}
