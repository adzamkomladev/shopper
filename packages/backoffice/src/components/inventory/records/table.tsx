import { Link } from "@tanstack/react-router";
import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { changeLabel, compactTime } from "../../../lib/inventory/format";
import { CAUSE_LABELS, kindOf } from "../../../lib/inventory/records";
import { shiftTime } from "../../../lib/shifts/format";
import type { RecordSummary } from "../../../queries/inventory/types";

const FROM_MD = "hidden md:table-cell";
const FROM_LG = "hidden lg:table-cell";
const BADGE = { receipt: "default", adjustment: "secondary", count: "outline" } as const;

const Dash = () => <span className="text-muted-foreground">—</span>;
const products = (count: number) => `${count} ${count === 1 ? "product" : "products"}`;

export function KindBadge({ kind }: { kind: RecordSummary["kind"] }) {
  return <Badge variant={BADGE[kind]}>{kindOf(kind).label}</Badge>;
}

const columns: DataTableColumn<RecordSummary>[] = [
  {
    id: "when",
    header: "Date",
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-1">
        <Link
          to="/stock/records/$documentId"
          params={{ documentId: row.original.id }}
          className="font-medium hover:underline"
        >
          <span className="md:hidden">{compactTime(row.original.occurredAt)}</span>
          <span className="hidden md:inline">{shiftTime(row.original.occurredAt)}</span>
        </Link>
        {/* A phone has no Type column: the kind sits under the date. */}
        <span className="md:hidden">
          <KindBadge kind={row.original.kind} />
        </span>
      </div>
    ),
  },
  {
    id: "type",
    header: "Type",
    meta: { className: FROM_MD },
    cell: ({ row }) => <KindBadge kind={row.original.kind} />,
  },
  {
    id: "source",
    header: "Supplier or cause",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => {
      const { supplierName, cause } = row.original;
      const text = supplierName ?? (cause ? CAUSE_LABELS[cause] : null);
      return (
        <div className="flex flex-col">
          {text ? <span className="wrap-break-word">{text}</span> : <Dash />}
          {/* A phone has no Total cost column: the cost, or an adjustment's change, sits under the name. */}
          {row.original.totalCost !== null ? (
            <span className="text-xs text-muted-foreground md:hidden">
              <Money amount={money(row.original.totalCost)} className="text-left" />
            </span>
          ) : (
            row.original.change && (
              <span className="text-xs text-muted-foreground md:hidden">
                {changeLabel(row.original.change.quantityThousandths, row.original.change.baseUnit)}
              </span>
            )
          )}
        </div>
      );
    },
  },
  {
    id: "reference",
    header: "Reference",
    meta: { className: FROM_LG },
    cell: ({ row }) => row.original.reference ?? <Dash />,
  },
  {
    id: "lines",
    header: "Items",
    meta: { className: FROM_LG },
    // A single-product adjustment shows what it did to stock, like "−2.5 kg".
    cell: ({ row }) =>
      row.original.change
        ? changeLabel(row.original.change.quantityThousandths, row.original.change.baseUnit)
        : products(row.original.lineCount),
  },
  {
    id: "by",
    header: "By",
    meta: { className: FROM_LG },
    cell: ({ row }) => row.original.actorName,
  },
  {
    id: "cost",
    header: "Total cost",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) =>
      row.original.totalCost === null ? <Dash /> : <Money amount={money(row.original.totalCost)} />,
  },
];

type Props = { records: RecordSummary[]; onEndReached: () => void };

export function RecordsTable({ records, onEndReached }: Props) {
  return (
    <DataTable
      label="Stock records"
      columns={columns}
      data={records}
      getRowId={(record) => record.id}
      onEndReached={onEndReached}
      className="min-h-0"
    />
  );
}
