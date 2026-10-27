import type { BranchesView } from "../../../schemas/reports/views";
import { bps, cash, ReportTable } from "../table";
import type { ReportColumn } from "../types";

type Row = BranchesView["rows"][number];

/** Every branch side by side over the period, with each one's share of net sales and the total last. */
export function BranchesTable({ report }: { report: BranchesView }) {
  return (
    <ReportTable
      label="Branch comparison"
      columns={columns}
      rows={report.rows}
      total={{ branchId: "total", name: "Total", ...report.total }}
      rowId={(row) => row.branchId}
    />
  );
}

const columns: ReportColumn<Row>[] = [
  { id: "name", header: "Branch", cell: (row) => row.name },
  {
    id: "transactions",
    header: "Sales",
    figure: true,
    from: "sm",
    cell: (row) => row.transactions.toLocaleString("en-GB"),
  },
  { id: "gross", header: "Gross", figure: true, from: "lg", cell: (row) => cash(row.gross) },
  {
    id: "refunds",
    header: "Refunded",
    figure: true,
    from: "lg",
    cell: (row) => cash(row.refundGross),
  },
  { id: "net", header: "Net sales", figure: true, cell: (row) => cash(row.netSales) },
  { id: "basket", header: "Basket", figure: true, from: "md", cell: (row) => cash(row.basket) },
  { id: "margin", header: "Margin", figure: true, from: "md", cell: (row) => cash(row.margin) },
  { id: "share", header: "Share", figure: true, cell: (row) => bps(row.shareBps) },
];
