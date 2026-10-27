import type { ShopperDatabase } from "@shopper/db-pg";
import { branchComparison } from "../branches";
import { dashboard } from "../dashboard";
import { deadStock } from "../dead";
import { journalReport } from "../journal";
import { productReport } from "../products";
import { salesReport } from "../sales";
import type { ReportCell, ReportTable } from "../types";

type Query = Record<string, string>;
type Tabulate = (
  db: ShopperDatabase,
  orgId: string,
  query: Query,
  scope?: string[],
) => Promise<ReportTable>;

const t = (value: string): ReportCell => ({ kind: "text", value });
const m = (value: number): ReportCell => ({ kind: "money", value });
const n = (value: number): ReportCell => ({ kind: "count", value });
const q = (value: number): ReportCell => ({ kind: "quantity", value });
const p = (value: number | null): ReportCell => ({ kind: "bps", value });
const range = (query: Query) =>
  query.from ? `${query.from}-to-${query.to}` : (query.day ?? query.on ?? "today");

/**
 * Every report as a table for CSV and Excel: the same rows the JSON report returns, in its order, then its total
 * row where it has one. A report's export reads exactly what its page shows.
 */
export const reportTables: Record<string, Tabulate> = {
  async dashboard(db, orgId, query, scope) {
    const report = await dashboard(db, orgId, query, scope);
    const k = report.kpis;
    const kpi = (label: string, figure: typeof k.netSales, cell: (value: number) => ReportCell) => [
      t(label),
      cell(figure.value),
      cell(figure.yesterday),
      p(figure.changeBps),
    ];
    return {
      name: `dashboard-${report.day}`,
      headers: ["Measure", report.day, report.yesterday, "Change %"],
      rows: [
        kpi("Net sales", k.netSales, m),
        kpi("Transactions", k.transactions, n),
        kpi("Average basket", k.basket, m),
        kpi("Items per basket", k.itemsPerBasket, q),
        kpi("Refunds", k.refunds, m),
        kpi("Margin", k.margin, m),
      ],
    };
  },
  async sales(db, orgId, query, scope) {
    const report = await salesReport(db, orgId, query, scope);
    const name = `sales-by-${report.by}-${range(query)}`;
    if (report.by === "tender")
      return {
        name,
        headers: ["Tender", "Transactions", "Taken", "Refunded", "Net", "Share %"],
        rows: [...report.rows, report.total].map((row) => [
          t(row.label),
          n(row.transactions),
          m(row.amount),
          m(row.refunded),
          m(row.net),
          p(row.shareBps),
        ]),
      };
    const by = { day: "Day", hour: "Hour", branch: "Branch", cashier: "Cashier" }[report.by];
    return {
      name,
      headers: [
        by,
        "Transactions",
        "Items",
        "Gross",
        "Discount",
        "Tax",
        "Net ex-tax",
        "Refunds",
        "Refunded gross",
        "Net sales",
        "Average basket",
      ],
      rows: [...report.rows, report.total].map((row) => [
        t(row.label),
        n(row.transactions),
        q(row.items),
        m(row.gross),
        m(row.discount),
        m(row.tax),
        m(row.net),
        n(row.refunds),
        m(row.refundGross),
        m(row.netSales),
        m(row.basket),
      ]),
    };
  },
  async products(db, orgId, query, scope) {
    const report = await productReport(db, orgId, query, scope);
    const total = report.total;
    return {
      name: `products-${range(query)}`,
      headers: [
        "SKU",
        "Product",
        "Sold",
        "Refunded",
        "Gross",
        "Refunded gross",
        "Discount",
        "Revenue ex-tax",
        "Cost",
        "Margin",
        "Margin %",
        "Costed",
      ],
      rows: [
        ...report.rows.map((row) => [
          t(row.sku),
          t(row.name),
          q(row.quantity),
          q(row.refundQuantity),
          m(row.gross),
          m(row.refundGross),
          m(row.discount),
          m(row.revenue),
          m(row.cost),
          m(row.margin),
          p(row.marginBps),
          t(row.costed),
        ]),
        [
          t(""),
          t("Total"),
          t(""),
          t(""),
          m(total.gross),
          m(total.refundGross),
          t(""),
          m(total.revenue),
        ].concat([
          m(total.cost),
          m(total.margin),
          p(total.marginBps),
          t(`${total.uncosted} not fully costed`),
        ]),
      ],
    };
  },
  async branches(db, orgId, query, scope) {
    const report = await branchComparison(db, orgId, query, scope);
    return {
      name: `branches-${range(query)}`,
      headers: [
        "Branch",
        "Transactions",
        "Gross",
        "Refunds",
        "Refunded gross",
        "Net sales",
        "Average basket",
        "Margin",
        "Share %",
      ],
      rows: [
        ...report.rows.map((row) => ({ ...row, label: row.name })),
        { ...report.total, label: "Total" },
      ].map((row) => [
        t(row.label),
        n(row.transactions),
        m(row.gross),
        n(row.refunds),
        m(row.refundGross),
        m(row.netSales),
        m(row.basket),
        m(row.margin),
        p(row.shareBps),
      ]),
    };
  },
  async "stock/dead"(db, orgId, query, scope) {
    const report = await deadStock(db, orgId, query, scope);
    return {
      name: `dead-stock-${report.days}-days-${report.asOf}`,
      headers: ["Branch", "SKU", "Product", "On hand", "Last sale", "Unit cost", "Value"],
      rows: [
        ...report.rows.map((row) => [
          t(row.branch),
          t(row.sku),
          t(row.name),
          q(row.onHand),
          t(row.lastSale ?? "Never"),
          { kind: "money", value: row.unitCost } as const,
          m(row.value),
        ]),
        [t("Total"), t(""), t(""), t(""), t(""), t(""), m(report.total)],
      ],
    };
  },
  async journal(db, orgId, query, scope) {
    const report = await journalReport(db, orgId, query, scope);
    return {
      name: `journal-${range(query)}`,
      headers: ["Date", "Branch", "Account", "Debit", "Credit"],
      rows: [
        ...report.rows.map((row) => [
          t(row.day),
          t(row.branch),
          t(row.account),
          m(row.debit),
          m(row.credit),
        ]),
        [t("Total"), t(""), t(""), m(report.total.debit), m(report.total.credit)],
      ],
    };
  },
};
