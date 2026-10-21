import { PackageXIcon } from "lucide-react";
import { formatGHS, lineTotal, money } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { changeLabel, quantityLabel } from "../../../lib/inventory/format";
import type { RecordDetail } from "../../../queries/inventory/types";
import { EmptyList } from "../../admin/states";

type Line = RecordDetail["lines"][number];

const FROM_MD = "hidden md:table-cell";
const Dash = () => <span className="text-muted-foreground">—</span>;
const ITEMS = { receipt: "received", adjustment: "adjusted", count: "counted" } as const;

/** The products of a record. A receipt shows what it cost; an adjustment or count shows the signed change. */
export function RecordItems({ record }: { record: RecordDetail }) {
  if (record.lines.length === 0)
    return (
      <EmptyList
        icon={PackageXIcon}
        title="No stock changed"
        description="Every product counted matched what was on hand, so this count moved nothing."
      />
    );
  const receipt = record.kind === "receipt";
  const columns: DataTableColumn<Line>[] = [
    {
      id: "product",
      header: "Product",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium wrap-break-word">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.sku}</span>
          {/* A phone has no Received or Unit cost column: what arrived and at what cost sits under the name. */}
          {receipt && (
            <span className="text-xs text-muted-foreground md:hidden">
              {quantityLabel(row.original.quantityThousandths, row.original.baseUnit)}
              {row.original.unitCost !== null && ` at ${formatGHS(money(row.original.unitCost))}`}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "quantity",
      header: receipt ? "Received" : "Change",
      meta: { align: "right", className: receipt ? FROM_MD : undefined },
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {receipt
            ? quantityLabel(row.original.quantityThousandths, row.original.baseUnit)
            : changeLabel(row.original.quantityThousandths, row.original.baseUnit)}
        </span>
      ),
    },
    ...(receipt
      ? ([
          {
            id: "unitCost",
            header: "Unit cost",
            meta: { align: "right", className: FROM_MD },
            cell: ({ row }) =>
              row.original.unitCost === null ? (
                <Dash />
              ) : (
                <Money amount={money(row.original.unitCost)} />
              ),
          },
          {
            id: "total",
            header: "Line total",
            meta: { align: "right" },
            cell: ({ row }) =>
              row.original.unitCost === null ? (
                <Dash />
              ) : (
                <Money
                  amount={lineTotal(money(row.original.unitCost), row.original.quantityThousandths)}
                />
              ),
          },
        ] satisfies DataTableColumn<Line>[])
      : []),
  ];
  return (
    <DataTable
      label={`Items ${ITEMS[record.kind]}`}
      columns={columns}
      data={record.lines}
      getRowId={(line) => line.productId}
      className="min-h-0"
    />
  );
}
