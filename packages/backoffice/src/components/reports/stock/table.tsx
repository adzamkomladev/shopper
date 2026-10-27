import { formatQuantity } from "@shopper/utils";
import type { DeadStockView } from "../../../schemas/reports/views";
import { cash, cedis, ReportTable } from "../table";
import type { ReportColumn } from "../types";

type Row = DeadStockView["rows"][number];

/** Stock on hand that has not sold in the window, worth its last receipt cost. */
export function DeadStockTable({ report }: { report: DeadStockView }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <dt className="text-sm text-muted-foreground">Tied up in dead stock</dt>
          <dd className="mt-1 text-2xl font-semibold whitespace-nowrap tabular-nums">
            {cedis(report.total)}
          </dd>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <dt className="text-sm text-muted-foreground">Products</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {report.rows.length.toLocaleString("en-GB")}
          </dd>
        </div>
      </dl>
      <ReportTable
        label={`Not sold in ${report.days} days`}
        columns={columns}
        rows={report.rows}
        rowId={(row) => `${row.branchId}|${row.productId}`}
      />
    </div>
  );
}

const columns: ReportColumn<Row>[] = [
  {
    id: "product",
    header: "Product",
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        <span className="text-xs text-muted-foreground">
          {row.sku} · {row.branch}
        </span>
      </span>
    ),
  },
  { id: "onHand", header: "On hand", figure: true, cell: (row) => formatQuantity(row.onHand) },
  { id: "lastSale", header: "Last sold", from: "sm", cell: (row) => row.lastSale ?? "Never" },
  {
    id: "unitCost",
    header: "Unit cost",
    figure: true,
    from: "md",
    cell: (row) => (row.unitCost === null ? "No cost" : cash(row.unitCost)),
  },
  { id: "value", header: "Value", figure: true, cell: (row) => cash(row.value) },
];
