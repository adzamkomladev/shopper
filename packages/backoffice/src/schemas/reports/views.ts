import * as v from "valibot";

const int = v.pipe(v.number(), v.safeInteger());
const figure = v.object({ value: int, yesterday: int, changeBps: v.nullable(int) });

export const dashboardView = v.object({
  day: v.string(),
  yesterday: v.string(),
  kpis: v.object({
    netSales: figure,
    transactions: figure,
    basket: figure,
    itemsPerBasket: figure,
    refunds: figure,
    margin: figure,
  }),
  top: v.array(v.object({ productId: v.string(), name: v.string(), netSales: int, quantity: int })),
  tenders: v.array(
    v.object({ kind: v.string(), label: v.string(), transactions: int, net: int, shareBps: int }),
  ),
  hours: v.array(v.object({ hour: int, today: int, yesterday: int })),
});
export type DashboardView = v.InferOutput<typeof dashboardView>;

const salesRow = v.object({
  key: v.string(),
  label: v.string(),
  transactions: int,
  items: int,
  gross: int,
  discount: int,
  tax: int,
  net: int,
  refunds: int,
  refundGross: int,
  netSales: int,
  basket: int,
});
const tenderRow = v.object({
  key: v.string(),
  label: v.string(),
  transactions: int,
  amount: int,
  refunded: int,
  net: int,
  shareBps: int,
});
export const salesView = v.variant("by", [
  v.object({ by: v.literal("tender"), rows: v.array(tenderRow), total: tenderRow }),
  v.object({
    by: v.picklist(["day", "hour", "branch", "cashier"]),
    rows: v.array(salesRow),
    total: salesRow,
  }),
]);
export type SalesView = v.InferOutput<typeof salesView>;

export const productsView = v.object({
  rows: v.array(
    v.object({
      productId: v.string(),
      sku: v.string(),
      name: v.string(),
      quantity: int,
      refundQuantity: int,
      gross: int,
      revenue: int,
      cost: int,
      margin: int,
      marginBps: int,
      costed: v.picklist(["all", "some", "none"]),
    }),
  ),
  total: v.object({ revenue: int, cost: int, margin: int, marginBps: int, uncosted: int }),
});
export type ProductsView = v.InferOutput<typeof productsView>;

const branchRow = {
  transactions: int,
  gross: int,
  refundGross: int,
  netSales: int,
  basket: int,
  margin: int,
  shareBps: int,
};
export const branchesView = v.object({
  rows: v.array(v.object({ branchId: v.string(), name: v.string(), ...branchRow })),
  total: v.object(branchRow),
});
export type BranchesView = v.InferOutput<typeof branchesView>;

export const deadStockView = v.object({
  days: int,
  asOf: v.string(),
  rows: v.array(
    v.object({
      branchId: v.string(),
      branch: v.string(),
      productId: v.string(),
      sku: v.string(),
      name: v.string(),
      onHand: int,
      lastSale: v.nullable(v.string()),
      unitCost: v.nullable(int),
      value: int,
    }),
  ),
  total: int,
});
export type DeadStockView = v.InferOutput<typeof deadStockView>;

export const journalView = v.object({
  rows: v.array(
    v.object({
      day: v.string(),
      branchId: v.string(),
      branch: v.string(),
      account: v.string(),
      debit: int,
      credit: int,
    }),
  ),
  total: v.object({ debit: int, credit: int }),
});
export type JournalView = v.InferOutput<typeof journalView>;

export const scopeView = v.object({
  branches: v.array(v.object({ id: v.string(), name: v.string() })),
});

/** Each report's API path under /reports, and the shape it answers with. */
export const reportViews = {
  dashboard: dashboardView,
  sales: salesView,
  products: productsView,
  branches: branchesView,
  "stock/dead": deadStockView,
  journal: journalView,
};
export type ReportKind = keyof typeof reportViews;
