import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { changeLabel, quantityLabel } from "../../../../lib/inventory/format";
import type { TakeLine } from "../../../../queries/inventory/types";

const FROM_MD = "hidden md:table-cell";
const Dash = () => <span className="text-muted-foreground">—</span>;

/** A variance: the word and sign always shown, and a warning chip when stock is out by anything. */
function Variance({ line }: { line: TakeLine }) {
  const variance = line.varianceThousandths;
  if (variance === null) return <Dash />;
  if (variance === 0) return <span className="text-muted-foreground">0 {line.baseUnit}</span>;
  return (
    <Badge className="border-warning-border bg-warning text-warning-foreground tabular-nums">
      {changeLabel(variance, line.baseUnit)}
    </Badge>
  );
}

const quantity = (thousandths: number | null, unit: string) =>
  thousandths === null ? (
    <Dash />
  ) : (
    <span className="tabular-nums">{quantityLabel(thousandths, unit)}</span>
  );

const columns: DataTableColumn<TakeLine>[] = [
  {
    id: "product",
    header: "Product",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium wrap-break-word">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.sku}</span>
      </div>
    ),
  },
  {
    id: "expected",
    header: "Expected",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) => quantity(row.original.expectedThousandths, row.original.baseUnit),
  },
  {
    id: "counted",
    header: "Counted",
    meta: { align: "right" },
    cell: ({ row }) => quantity(row.original.countedThousandths, row.original.baseUnit),
  },
  {
    id: "variance",
    header: "Variance",
    meta: { align: "right" },
    cell: ({ row }) => <Variance line={row.original} />,
  },
  {
    id: "value",
    header: "Variance value",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) =>
      row.original.varianceValue === null ? (
        <Dash />
      ) : (
        <Money amount={money(row.original.varianceValue)} />
      ),
  },
];

// A take that was cancelled, or is only being read, has counts and nothing to compare them with.
const countsOnly = columns.filter(
  (column) => column.id !== "expected" && column.id !== "variance" && column.id !== "value",
);

type Props = { lines: TakeLine[]; label: string; compare: boolean };

/** Expected, counted, variance and what the variance is worth, line by line; or just the counts. */
export function ReviewTable({ lines, label, compare }: Props) {
  return (
    <DataTable
      label={label}
      columns={compare ? columns : countsOnly}
      data={lines}
      getRowId={(line) => line.productId}
      className="min-h-72"
    />
  );
}
