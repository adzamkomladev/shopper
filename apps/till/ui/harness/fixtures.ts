// Test-only fixtures for the till UI harness. Never imported by src/ or built into the app.
import { add, money, mulQty, mulRate, mulRatio, sub, type Money } from "@shopper/money";
import type {
  CatalogueMatch,
  DraftLine,
  DraftView,
  QuoteLine,
  SaleTotals,
} from "../src/sale/types";

const rates = { vatBps: 1500, nhilBps: 250, getfundBps: 250, covidBps: 0 };
export const today = "2026-10-15T09:30:00.000Z";
export const id = (suffix: string) => `10000000-0000-7000-8000-${suffix.padStart(12, "0")}`;

type Spec = {
  id: string;
  sku: string;
  name: string;
  unitPrice: Money;
  quantityThousandths?: number;
  baseUnit?: string;
  label?: DraftLine["label"];
  covidBps?: number;
  /** Set when a manager changed the price: `unitPrice` is the override and this is what it replaced. */
  listPrice?: Money;
};

function quote(spec: Spec): { line: DraftLine; quote: QuoteLine } {
  const quantity = spec.quantityThousandths ?? 1000;
  const gross = mulQty(spec.unitPrice, quantity);
  const rule = { ...rates, covidBps: spec.covidBps ?? 0 };
  const base = mulRatio(
    gross,
    10_000,
    10_000 + rule.vatBps + rule.nhilBps + rule.getfundBps + rule.covidBps,
  );
  const taxes = {
    vat: mulRate(base, rule.vatBps),
    nhil: mulRate(base, rule.nhilBps),
    getfund: mulRate(base, rule.getfundBps),
    covid: mulRate(base, rule.covidBps),
  };
  const calculated = add(add(taxes.vat, taxes.nhil), add(add(taxes.getfund, taxes.covid), base));
  return {
    line: {
      id: spec.id,
      productId: `p-${spec.id}`,
      quantityThousandths: quantity,
      discount: money(0),
      label: spec.label,
      override:
        spec.listPrice === undefined
          ? undefined
          : { unitPrice: spec.unitPrice, reason: "Price match", approverId: id("21") },
    },
    quote: {
      lineId: spec.id,
      productId: `p-${spec.id}`,
      priceId: `price-${spec.id}`,
      listPrice: spec.listPrice,
      sku: spec.sku,
      name: spec.name,
      baseUnit: spec.baseUnit ?? "each",
      tax: {
        base,
        ...taxes,
        gross,
        roundingAdjustment: sub(gross, calculated),
        rule: { ...rule, id: `rule-${spec.id}`, effectiveFrom: "2026-01-01" },
        on: "2026-10-15",
        taxClass: "standard",
        priceMode: "inclusive",
        registered: true,
        quantityThousandths: quantity,
        unitPrice: spec.unitPrice,
        discount: money(0),
      },
    },
  };
}

function totalsOf(quotes: QuoteLine[]): SaleTotals {
  const totals = {
    base: money(0),
    vat: money(0),
    nhil: money(0),
    getfund: money(0),
    covid: money(0),
    gross: money(0),
    roundingAdjustment: money(0),
  };
  for (const line of quotes) {
    if (line.error !== undefined) continue;
    totals.base = add(totals.base, line.tax.base);
    totals.vat = add(totals.vat, line.tax.vat);
    totals.nhil = add(totals.nhil, line.tax.nhil);
    totals.getfund = add(totals.getfund, line.tax.getfund);
    totals.covid = add(totals.covid, line.tax.covid);
    totals.gross = add(totals.gross, line.tax.gross);
    totals.roundingAdjustment = add(totals.roundingAdjustment, line.tax.roundingAdjustment);
  }
  return totals;
}

export function basket(specs: Spec[], broken: { id: string; error: string }[] = []): DraftView {
  const built = specs.map(quote);
  const lines = built.map((entry) => entry.line);
  const quotes: QuoteLine[] = built.map((entry) => entry.quote);
  for (const { id: lineId, error } of broken) {
    lines.push({
      id: lineId,
      productId: `p-${lineId}`,
      quantityThousandths: 1000,
      discount: money(0),
    });
    quotes.push({ lineId, productId: `p-${lineId}`, error });
  }
  const totals = totalsOf(quotes);
  return {
    draft: {
      id: id("1"),
      status: "open",
      name: null,
      revision: lines.length,
      createdAt: today,
      updatedAt: today,
      tenders: [],
      lines,
    },
    cashRounding: "none",
    settlement: {
      gross: totals.gross,
      roundingLine: money(0),
      total: totals.gross,
      nonCash: money(0),
      cash: money(0),
      balance: totals.gross,
      change: money(0),
    },
    quote: { lines: quotes, totals, changed: false },
  };
}

export const emptyView: DraftView = {
  draft: null,
  cashRounding: "none",
  settlement: {
    gross: money(0),
    roundingLine: money(0),
    total: money(0),
    nonCash: money(0),
    cash: money(0),
    balance: money(0),
    change: money(0),
  },
  quote: { lines: [], totals: totalsOf([]), changed: false },
};

export const items: Spec[] = [
  { id: "l1", sku: "10482", name: "Milo 400g tin", unitPrice: money(545_000) },
  {
    id: "l2",
    sku: "20915",
    name: "Voltic natural water 1.5L",
    unitPrice: money(80_000),
    quantityThousandths: 6000,
  },
  {
    id: "l3",
    sku: "30127",
    name: "Gari, white",
    unitPrice: money(220_000),
    baseUnit: "kg",
    quantityThousandths: 500,
    label: { kind: "weight", code: "2100123005001" },
  },
  {
    id: "l4",
    sku: "11205",
    name: "Fan Milk Vanilla ice cream",
    unitPrice: money(65_000),
    quantityThousandths: 2000,
  },
  { id: "l5", sku: "40018", name: "Geisha soap 175g", unitPrice: money(72_500) },
  { id: "l6", sku: "40930", name: "Frytol cooking oil 1L", unitPrice: money(380_000) },
  {
    id: "l7",
    sku: "10611",
    name: "Titus sardines 125g",
    unitPrice: money(127_500),
    quantityThousandths: 3000,
  },
];

/** Printed with its price by the scale, so its price cannot be overridden at the till. */
export const priceLabelled: Spec = {
  id: "l8",
  sku: "50001",
  name: "Deli ham, price-labelled",
  unitPrice: money(184_000),
  label: {
    kind: "price",
    code: "2200001840008",
    gross: money(184_000),
    originalQuantityThousandths: 1000,
    originalPriceId: id("55"),
  },
};

export const matches: CatalogueMatch[] = [
  { productId: "p-l1", sku: "10482", name: "Milo 400g tin", match: "name" },
  { productId: "p-m2", sku: "10483", name: "Milo 1kg refill pouch", match: "name" },
  {
    productId: "p-m3",
    sku: "10490",
    name: "Milo cube sachets, box of 24",
    match: "barcode",
    barcode: "6161100491234",
    quantityThousandths: 24_000,
  },
];

export type { Money };
