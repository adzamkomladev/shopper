// Test-only fixtures for the sale screen harness. Never imported by src/, never built into the app.
import { add, money, mulQty, mulRate, mulRatio, sub, type Money } from "@shopper/money";
import type {
  CatalogueMatch,
  DraftLine,
  DraftView,
  QuoteLine,
  SaleSnapshot,
  SaleTotals,
} from "../src/sale/types";

const rates = { vatBps: 1500, nhilBps: 250, getfundBps: 250, covidBps: 0 };
const pesewas = (ghs: number) => money(Math.round(ghs * 10_000));

type Spec = {
  id: string;
  sku: string;
  name: string;
  unitGhs: number;
  quantityThousandths?: number;
  baseUnit?: string;
  label?: DraftLine["label"];
  covidBps?: number;
};

function quote(spec: Spec): { line: DraftLine; quote: QuoteLine } {
  const quantity = spec.quantityThousandths ?? 1000;
  const unitPrice = pesewas(spec.unitGhs);
  const gross = mulQty(unitPrice, quantity);
  const rule = { ...rates, covidBps: spec.covidBps ?? 0 };
  return {
    line: {
      id: spec.id,
      productId: `p-${spec.id}`,
      quantityThousandths: quantity,
      label: spec.label,
    },
    quote: {
      lineId: spec.id,
      productId: `p-${spec.id}`,
      sku: spec.sku,
      name: spec.name,
      baseUnit: spec.baseUnit ?? "each",
      tax: { unitPrice, gross, rule },
    },
  };
}

function totalsOf(quotes: QuoteLine[]): SaleTotals {
  const zero = money(0);
  const totals = {
    base: zero,
    vat: zero,
    nhil: zero,
    getfund: zero,
    covid: zero,
    gross: zero,
    roundingAdjustment: zero,
  };
  for (const line of quotes) {
    if (line.error !== undefined) continue;
    const { gross, rule } = line.tax;
    const sum = rule.vatBps + rule.nhilBps + rule.getfundBps + rule.covidBps;
    const base = mulRatio(gross, 10_000, 10_000 + sum);
    const parts = {
      vat: mulRate(base, rule.vatBps),
      nhil: mulRate(base, rule.nhilBps),
      getfund: mulRate(base, rule.getfundBps),
      covid: mulRate(base, rule.covidBps),
    };
    const calculated = [parts.vat, parts.nhil, parts.getfund, parts.covid].reduce(add, base);
    totals.base = add(totals.base, base);
    for (const key of ["vat", "nhil", "getfund", "covid"] as const)
      totals[key] = add(totals[key], parts[key]);
    totals.gross = add(totals.gross, gross);
    totals.roundingAdjustment = add(totals.roundingAdjustment, sub(gross, calculated));
  }
  return totals;
}

export function basket(specs: Spec[], broken: { id: string; error: string }[] = []): DraftView {
  const built = specs.map(quote);
  const lines = built.map((entry) => entry.line);
  const quotes: QuoteLine[] = built.map((entry) => entry.quote);
  for (const { id, error } of broken) {
    lines.push({ id, productId: `p-${id}`, quantityThousandths: 1000 });
    quotes.push({ lineId: id, productId: `p-${id}`, error });
  }
  return {
    draft: { id: "draft-1", revision: lines.length, lines },
    quote: { lines: quotes, totals: totalsOf(quotes) },
  };
}

export const emptyView: DraftView = {
  draft: null,
  quote: { lines: [], totals: totalsOf([]) },
};

export const items: Spec[] = [
  { id: "l1", sku: "10482", name: "Milo 400g tin", unitGhs: 54.5 },
  {
    id: "l2",
    sku: "20915",
    name: "Voltic natural water 1.5L",
    unitGhs: 8,
    quantityThousandths: 6000,
  },
  {
    id: "l3",
    sku: "30127",
    name: "Gari, white",
    unitGhs: 22,
    baseUnit: "kg",
    quantityThousandths: 500,
    label: { kind: "weight", code: "2100123005001" },
  },
  {
    id: "l4",
    sku: "11205",
    name: "Fan Milk Vanilla ice cream",
    unitGhs: 6.5,
    quantityThousandths: 2000,
  },
  { id: "l5", sku: "40018", name: "Geisha soap 175g", unitGhs: 7.25 },
  { id: "l6", sku: "40930", name: "Frytol cooking oil 1L", unitGhs: 38 },
  {
    id: "l7",
    sku: "10611",
    name: "Titus sardines 125g",
    unitGhs: 12.75,
    quantityThousandths: 3000,
  },
];

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

const base: SaleSnapshot = {
  host: "connected",
  loading: false,
  view: basket(items.slice(0, 4)),
  failure: null,
  busy: false,
  search: { query: "", status: "idle", matches: [] },
  feedback: null,
  sync: { offline: false, pendingCount: 0, canSync: true, syncing: false },
};

const searched = (
  query: string,
  over: Partial<SaleSnapshot["search"]>,
): SaleSnapshot["search"] => ({
  query,
  status: "ready",
  matches,
  ...over,
});

export const scenarios: Record<string, SaleSnapshot> = {
  lines: base,
  many: { ...base, view: basket(items) },
  empty: { ...base, view: emptyView },
  loading: { ...base, loading: true, view: null },
  busy: { ...base, busy: true },
  levy: { ...base, view: basket([{ ...items[0]!, covidBps: 100 }, items[1]!]) },
  results: { ...base, search: searched("milo", {}) },
  searching: { ...base, search: searched("milo", { status: "loading", matches: [] }) },
  nomatch: { ...base, search: searched("milo", { matches: [] }) },
  searchfail: { ...base, search: searched("milo", { status: "failed", matches: [] }) },
  unknown: { ...base, feedback: { kind: "unknown", code: "5012345600001" } },
  rejected: {
    ...base,
    feedback: { kind: "rejected", message: "A scanned code carries its own quantity." },
  },
  unavailable: {
    ...base,
    view: basket(items.slice(0, 2), [
      { id: "x1", error: "PRICE_MISSING" },
      { id: "x2", error: "PRODUCT_UNKNOWN" },
    ]),
  },
  session: { ...base, failure: "session" },
  permission: { ...base, failure: "permission" },
  storage: { ...base, failure: "storage", view: null },
  offline: { ...base, sync: { offline: true, pendingCount: 3, canSync: false, syncing: false } },
  disconnected: { ...base, host: "disconnected", sync: { ...base.sync, canSync: false } },
  connecting: {
    ...base,
    host: "connecting",
    view: null,
    loading: true,
    sync: { ...base.sync, canSync: false },
  },
  syncing: { ...base, sync: { offline: false, pendingCount: 2, canSync: false, syncing: true } },
};

export type { Money };
