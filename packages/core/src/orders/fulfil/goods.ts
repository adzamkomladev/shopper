import { add, money, sub, type Money } from "@shopper/money";
import { snapshotAmount, snapshotLine, type TaxSnapshot } from "@shopper/tax";
import type { BaseUnit, onlineOrderLine, onlineOrderPick } from "@shopper/db-pg";
import { accraClock } from "../../receipts/build";
import type { ReceiptDocument } from "../../schemas/receipts/document";
import type { Item } from "../types";

type Line = typeof onlineOrderLine.$inferSelect;
type Pick = typeof onlineOrderPick.$inferSelect;
type Payload = { name: string; baseUnit?: BaseUnit; tax: TaxSnapshot };

const amounts = ["base", "vat", "nhil", "getfund", "covid", "gross", "roundingAdjustment"] as const;

/**
 * An amount the payer can be paid back: a tax-inclusive gross rounded to a whole pesewa (a weighed 0.501 kg of rice
 * is not a whole number of pesewas), with the tax taken out of the rounded amount so the parts still add up.
 */
export function wholePesewa(tax: TaxSnapshot): TaxSnapshot {
  if (tax.gross % 100 === 0 || tax.priceMode !== "inclusive") return tax;
  return snapshotAmount({
    rule: tax.rule,
    on: tax.on,
    taxClass: tax.taxClass,
    priceMode: tax.priceMode,
    registered: tax.registered,
    unitPrice: tax.unitPrice,
    quantityThousandths: tax.quantityThousandths,
    gross: money(Math.round(tax.gross / 100) * 100),
  });
}

/** What `missing` of a line was worth: its own price version and tax rule, quoted again at that quantity. */
export const quoteMissing = (tax: TaxSnapshot, missing: number) =>
  wholePesewa(
    snapshotLine({
      rule: tax.rule,
      on: tax.on,
      taxClass: tax.taxClass,
      priceMode: tax.priceMode,
      registered: tax.registered,
      unitPrice: tax.unitPrice,
      quantityThousandths: missing,
    }),
  );

/** What stays of a line once `credit` is taken off it, amount by amount, so the two always add up to the line. */
const remainder = (tax: TaxSnapshot, credit: TaxSnapshot, kept: number): TaxSnapshot => ({
  ...tax,
  quantityThousandths: kept,
  ...Object.fromEntries(amounts.map((key) => [key, sub(tax[key], credit[key])])),
});

/**
 * The order's goods as picking left them. A line with no pick, or picked in full, stays whole. A short line splits
 * into what was missing (`credits`, to be credited), what stays (`kept`) and its substitute, if any (`substitutes`,
 * charged at no more than the missing quantity cost). The delivery fee always stays.
 */
export function goodsOf(lines: Line[], picks: Pick[]) {
  const byLine = new Map(picks.map((pick) => [pick.lineId, pick]));
  const credits: Item[] = [];
  const kept: Item[] = [];
  const substitutes: Item[] = [];
  /** Per product: what came back on the shelf and what went out in place of it, in thousandths. */
  const returned: { productId: string; quantityThousandths: number }[] = [];
  const replaced: { productId: string; quantityThousandths: number }[] = [];
  for (const line of lines) {
    const payload = line.payload as Payload;
    const item = (tax: TaxSnapshot): Item => ({
      name: payload.name,
      unit: payload.baseUnit ?? "each",
      productId: line.productId,
      tax,
    });
    const pick = byLine.get(line.id);
    const missing = pick ? line.quantityThousandths - pick.pickedThousandths : 0;
    if (!line.productId || missing <= 0) {
      kept.push(item(payload.tax));
      continue;
    }
    const credit = quoteMissing(payload.tax, missing);
    credits.push(item(credit));
    returned.push({ productId: line.productId, quantityThousandths: missing });
    if (pick!.pickedThousandths > 0)
      kept.push(item(remainder(payload.tax, credit, pick!.pickedThousandths)));
    if (pick!.substituteProductId) {
      const sold = pick!.substitutePayload as Payload;
      substitutes.push({
        name: sold.name,
        unit: sold.baseUnit ?? "each",
        productId: pick!.substituteProductId,
        tax: sold.tax,
      });
      replaced.push({
        productId: pick!.substituteProductId,
        quantityThousandths: pick!.substituteQuantityThousandths!,
      });
    }
  }
  return { credits, kept, substitutes, returned, replaced };
}

export const totalOf = (items: Item[]) =>
  Object.fromEntries(
    amounts.map((key) => [key, items.reduce((sum, item) => add(sum, item.tax[key]), money(0))]),
  ) as Record<(typeof amounts)[number], Money>;

/** An invoice or credit note over exactly these items, made out like the order's own receipt. */
export function documentOf(
  base: ReceiptDocument,
  items: Item[],
  as: { kind: "sale" | "refund"; number: string; at: Date },
): ReceiptDocument {
  const total = totalOf(items);
  const baseFor = (taxClass: "zero-rated" | "exempt") =>
    items
      .filter((item) => item.tax.taxClass === taxClass)
      .reduce((sum, item) => add(sum, item.tax.base), money(0));
  return {
    ...base,
    kind: as.kind,
    refundOf: as.kind === "refund" ? base.header.receiptNumber : null,
    header: {
      ...base.header,
      receiptNumber: as.number,
      utcTime: as.at.toISOString(),
      accraTime: accraClock(as.at),
    },
    lines: items.map(({ name, unit, tax }) => ({
      name,
      quantityThousandths: tax.quantityThousandths,
      unit,
      unitPrice: tax.unitPrice,
      discount: tax.discount,
      gross: tax.gross,
      net: tax.base,
      taxClass: tax.taxClass,
    })),
    taxSummary: {
      net: total.base,
      nhil: total.nhil,
      getfund: total.getfund,
      covid: total.covid,
      vat: total.vat,
      zeroRatedBase: baseFor("zero-rated"),
      exemptBase: baseFor("exempt"),
    },
    subtotal: total.gross,
    discountTotal: money(0),
    gross: total.gross,
    cashRounding: money(0),
    total: total.gross,
    paid: as.kind === "refund" ? money(0) : total.gross,
    change: money(0),
    tenders: base.tenders.map((tender) => ({ ...tender, amount: total.gross })),
    fiscal: null,
  };
}
