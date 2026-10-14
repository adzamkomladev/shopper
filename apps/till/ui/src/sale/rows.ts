import type { DraftLine, DraftView, LineErrorCode, QuoteLine } from "./types";

export type Row = QuoteLine & { line: DraftLine };
export type PricedRow = Row & { error?: undefined };

/** Joins the stored draft lines with their quote, in basket order. */
export function rowsOf(view: DraftView | null): Row[] {
  if (!view?.draft) return [];
  const quotes = new Map(view.quote.lines.map((quote) => [quote.lineId, quote]));
  return view.draft.lines.flatMap((line) => {
    const quote = quotes.get(line.id);
    return quote ? [{ ...quote, line }] : [];
  });
}

export const isPriced = (row: Row): row is PricedRow => row.error === undefined;

/** The line a keyboard edit applies to: the selected one, else the newest. */
export function selectedRow(rows: Row[], selectedId: string | null) {
  return rows.find((row) => row.lineId === selectedId) ?? rows.at(-1);
}

export function lineProblem(code: LineErrorCode) {
  const copy: Record<string, string> = {
    PRODUCT_UNKNOWN: "This product is no longer in the catalogue.",
    PRICE_MISSING: "This product has no price at this branch.",
    TAX_RULE_MISSING: "No tax rule applies today.",
    QUANTITY_INVALID: "This quantity is not valid.",
  };
  return copy[code] ?? "This line cannot be priced.";
}
