import { formatQuantity } from "@shopper/utils";
import type { SalesView } from "../../../schemas/reports/views";
import { bps, cash, ReportTable } from "../table";
import type { ReportColumn } from "../types";

type ByTender = Extract<SalesView, { by: "tender" }>;
type BySales = Exclude<SalesView, { by: "tender" }>;

const HEADINGS = { day: "Day", hour: "Hour", branch: "Branch", cashier: "Cashier" } as const;

/** Sales grouped by day, hour, branch, cashier or tender, with the period's total last. */
export function SalesTable({ report }: { report: SalesView }) {
  if (report.by === "tender")
    return (
      <ReportTable
        label="Sales by tender"
        columns={tenderColumns}
        rows={report.rows}
        total={report.total}
        rowId={(row) => row.key}
      />
    );
  return (
    <ReportTable
      label={`Sales by ${report.by}`}
      columns={salesColumns(report.by)}
      rows={report.rows}
      total={report.total}
      rowId={(row) => row.key}
    />
  );
}

const salesColumns = (by: BySales["by"]): ReportColumn<BySales["rows"][number]>[] => [
  { id: "label", header: HEADINGS[by], cell: (row) => row.label },
  {
    id: "transactions",
    header: "Sales",
    figure: true,
    cell: (row) => row.transactions.toLocaleString("en-GB"),
  },
  {
    id: "items",
    header: "Items",
    figure: true,
    from: "lg",
    cell: (row) => formatQuantity(row.items),
  },
  { id: "gross", header: "Gross", figure: true, from: "md", cell: (row) => cash(row.gross) },
  {
    id: "discount",
    header: "Discounts",
    figure: true,
    from: "lg",
    cell: (row) => cash(row.discount),
  },
  { id: "tax", header: "Tax", figure: true, from: "lg", cell: (row) => cash(row.tax) },
  {
    id: "refunds",
    header: "Refunded",
    figure: true,
    from: "md",
    cell: (row) => cash(row.refundGross),
  },
  { id: "net", header: "Net sales", figure: true, cell: (row) => cash(row.netSales) },
  { id: "basket", header: "Basket", figure: true, from: "lg", cell: (row) => cash(row.basket) },
];

const tenderColumns: ReportColumn<ByTender["rows"][number]>[] = [
  { id: "label", header: "Tender", cell: (row) => row.label },
  {
    id: "transactions",
    header: "Sales",
    figure: true,
    cell: (row) => row.transactions.toLocaleString("en-GB"),
  },
  { id: "amount", header: "Taken", figure: true, from: "md", cell: (row) => cash(row.amount) },
  {
    id: "refunded",
    header: "Paid back",
    figure: true,
    from: "md",
    cell: (row) => cash(row.refunded),
  },
  { id: "net", header: "Net", figure: true, cell: (row) => cash(row.net) },
  { id: "share", header: "Share", figure: true, from: "sm", cell: (row) => bps(row.shareBps) },
];
