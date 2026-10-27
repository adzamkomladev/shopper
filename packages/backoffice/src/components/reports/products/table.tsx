import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { formatQuantity } from "@shopper/utils";
import type { ProductsView } from "../../../schemas/reports/views";
import { bps, cash, cedis, ReportTable } from "../table";
import type { ReportColumn } from "../types";

type Row = ProductsView["rows"][number];
const FILTER_ID = "report-products-filter";

/** What the period's sales and refunds earned per product, its margin, and whether every unit had a cost. */
export function ProductsReport({ report }: { report: ProductsView }) {
  const [filter, setFilter] = useState("");
  const shortcuts = useShortcuts({ "/": () => document.getElementById(FILTER_ID)?.focus() });
  const needle = filter.trim().toLowerCase();
  const rows = report.rows.filter(
    (row) => row.name.toLowerCase().includes(needle) || row.sku.toLowerCase().includes(needle),
  );
  const tiles = [
    ["Revenue before tax", cedis(report.total.revenue)],
    ["Cost of what sold", cedis(report.total.cost)],
    ["Margin", cedis(report.total.margin)],
    ["Margin %", bps(report.total.marginBps)],
  ] as const;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-4">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold whitespace-nowrap tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {report.total.uncosted > 0 && (
        <p
          role="note"
          className="rounded-lg border border-warning-border bg-warning px-4 py-3 text-sm text-warning-foreground"
        >
          {report.total.uncosted === 1
            ? "1 product was"
            : `${report.total.uncosted.toLocaleString("en-GB")} products were`}{" "}
          sold without a receipt cost, so their margin counts those units as free. Receive stock
          with its cost to complete it.
        </p>
      )}
      <InputGroup className="sm:max-w-sm">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={FILTER_ID}
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Name or SKU"
          aria-label="Filter products"
        />
        <InputGroupAddon align="inline-end">
          <Kbd aria-hidden>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      {rows.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          No product matches “{filter.trim()}”.
        </p>
      ) : (
        <ReportTable
          label="Products"
          columns={columns}
          rows={rows}
          rowId={(row) => row.productId}
        />
      )}
    </div>
  );
}

const columns: ReportColumn<Row>[] = [
  {
    id: "product",
    header: "Product",
    cell: (row) => (
      <span className="flex flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {row.name}
          {row.costed !== "all" && (
            <Badge variant="outline" className="border-warning-border text-warning-foreground">
              {row.costed === "none" ? "No cost" : "Part costed"}
            </Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{row.sku}</span>
      </span>
    ),
  },
  { id: "sold", header: "Sold", figure: true, cell: (row) => formatQuantity(row.quantity) },
  {
    id: "refunded",
    header: "Refunded",
    figure: true,
    from: "lg",
    cell: (row) => formatQuantity(row.refundQuantity),
  },
  { id: "revenue", header: "Revenue", figure: true, from: "md", cell: (row) => cash(row.revenue) },
  { id: "cost", header: "Cost", figure: true, from: "lg", cell: (row) => cash(row.cost) },
  { id: "margin", header: "Margin", figure: true, cell: (row) => cash(row.margin) },
  {
    id: "marginBps",
    header: "Margin %",
    figure: true,
    from: "sm",
    cell: (row) => bps(row.marginBps),
  },
];
