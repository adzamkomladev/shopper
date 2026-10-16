import * as v from "valibot";
import { canonicalJson } from "@shopper/audit";
import type { saleDraftLine } from "@shopper/db-sqlite";
import { add, money, mulRatio, sub } from "@shopper/money";
import { snapshotAmount } from "@shopper/tax";
import { saleTotals } from "../../schemas/till/sale";
import { TillError } from "../error";
import { quoteFrom, type readQuoteReference } from "../quotation";
import type { QuoteLine } from "../types";

type Line = typeof saleDraftLine.$inferSelect;
type References = Awaited<ReturnType<typeof readQuoteReference>>;
const zero = {
  base: 0,
  vat: 0,
  nhil: 0,
  getfund: 0,
  covid: 0,
  gross: 0,
  roundingAdjustment: 0,
};

/** Quotes every draft line at `at`; a line whose reference data went away carries its error code and is left out of the totals. */
export function quoteDraft(
  refs: References,
  branchId: string,
  at: Date,
  lines: Line[],
  stored: unknown,
) {
  const quoted: QuoteLine[] = lines.map((line) => {
    try {
      return { lineId: line.id, ...quoteDraftLine(refs, branchId, at, line) };
    } catch (error) {
      if (error instanceof TillError)
        return { lineId: line.id, productId: line.productId, error: error.code };
      throw error;
    }
  });
  const totals = v.parse(saleTotals, zero);
  for (const line of quoted)
    if (!("error" in line))
      for (const key of Object.keys(totals) as (keyof typeof totals)[])
        totals[key] = add(totals[key], line.tax[key]);
  const changed =
    quoted.some((line) => "error" in line) || canonicalJson(stored) !== canonicalJson(totals);
  return { lines: quoted, totals, changed };
}

/** Price labels keep the encoded gross, scaled by integer ratio to the edited quantity; other lines price at the unit price. */
export function quoteDraftLine(refs: References, branchId: string, at: Date, line: Line) {
  const { productId, quantityThousandths, label } = line;
  const quote = quoteFrom(refs, { branchId, at, productId, quantityThousandths });
  if (label?.kind !== "price") {
    if (line.discount < 0 || line.discount > quote.tax.gross)
      throw new TillError("DISCOUNT_INVALID", "Discount exceeds line gross");
    const tax = snapshotAmount({ ...quote.tax, gross: sub(quote.tax.gross, money(line.discount)) });
    return { ...quote, tax: { ...tax, discount: money(line.discount) } };
  }
  const { rule, on, taxClass, unitPrice } = quote.tax;
  const gross = mulRatio(
    money(label.gross),
    quantityThousandths,
    label.originalQuantityThousandths,
  );
  if (line.discount < 0 || line.discount > gross)
    throw new TillError("DISCOUNT_INVALID", "Discount exceeds line gross");
  const tax = snapshotAmount({
    rule,
    on,
    taxClass,
    priceMode: "inclusive",
    unitPrice,
    quantityThousandths,
    gross: sub(gross, money(line.discount)),
  });
  return { ...quote, tax: { ...tax, discount: money(line.discount) } };
}
