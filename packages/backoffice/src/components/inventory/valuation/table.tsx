import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { quantityLabel } from "../../../lib/inventory/format";
import type { ValuationLine } from "../../../queries/inventory/types";

const FROM_MD = "hidden md:table-cell";

/** Why a line is worth what it is: no receipt had a cost, or stock is below zero. The words carry it. */
function Flag({ flag }: { flag: ValuationLine["flag"] }) {
  if (flag === "no_cost")
    return (
      <Badge className="border-warning-border bg-warning text-warning-foreground">No cost</Badge>
    );
  if (flag === "negative") return <Badge variant="destructive">Negative stock</Badge>;
  return null;
}

const columns: DataTableColumn<ValuationLine>[] = [
  {
    id: "product",
    header: "Product",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium wrap-break-word">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.sku}</span>
        {/* A phone has no On hand or Flags column: what is held and its flag sit under the name. */}
        <span className="text-xs text-muted-foreground tabular-nums md:hidden">
          {quantityLabel(row.original.onHandThousandths, row.original.baseUnit)}
        </span>
        <span className="mt-1 md:hidden">
          <Flag flag={row.original.flag} />
        </span>
      </div>
    ),
  },
  {
    id: "onHand",
    header: "On hand",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {quantityLabel(row.original.onHandThousandths, row.original.baseUnit)}
      </span>
    ),
  },
  {
    id: "cost",
    header: "Last unit cost",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) =>
      row.original.unitCost === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <Money amount={money(row.original.unitCost)} />
      ),
  },
  {
    id: "value",
    header: "Value",
    meta: { align: "right" },
    cell: ({ row }) => <Money amount={money(row.original.value)} className="font-medium" />,
  },
  {
    id: "flags",
    header: "Flags",
    meta: { className: FROM_MD },
    cell: ({ row }) => <Flag flag={row.original.flag} />,
  },
];

export function ValuationTable({ lines }: { lines: ValuationLine[] }) {
  return (
    <DataTable
      label="Stock valuation"
      columns={columns}
      data={lines}
      getRowId={(line) => line.productId}
      className="min-h-52"
    />
  );
}
