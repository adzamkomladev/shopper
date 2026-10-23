import { Link } from "@tanstack/react-router";
import { add, money } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { AGEING_BUCKETS, type AgeingRow } from "../../../schemas/customers/account";

const BUCKET_LABELS = {
  current: "Current",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "Over 90",
} as const;

/** A customer who owes, or the row that adds them all up. */
type Line = AgeingRow & { isTotal?: boolean };

const sum = (rows: AgeingRow[], pick: (row: AgeingRow) => number) =>
  rows.reduce((all, row) => add(all, money(pick(row))), money(0));

const columns: DataTableColumn<Line>[] = [
  {
    id: "customer",
    header: "Customer",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) =>
      row.original.isTotal ? (
        <span className="font-semibold">All customers</span>
      ) : (
        <div className="flex min-w-0 flex-col">
          <Link
            to="/customers/$customerId"
            params={{ customerId: row.original.id }}
            className="w-fit font-medium wrap-break-word hover:underline"
          >
            {row.original.name}
          </Link>
          <span className="text-xs text-muted-foreground tabular-nums">{row.original.phone}</span>
        </div>
      ),
  },
  ...AGEING_BUCKETS.map((bucket): DataTableColumn<Line> => ({
    id: bucket,
    header: BUCKET_LABELS[bucket],
    meta: { align: "right", className: "hidden md:table-cell" },
    cell: ({ row }) => (
      <Money
        amount={row.original.buckets[bucket]!}
        className={row.original.isTotal ? "font-semibold" : undefined}
      />
    ),
  })),
  {
    id: "total",
    header: "Owed",
    meta: { align: "right" },
    cell: ({ row }) => <Money amount={row.original.total} className="font-semibold" />,
  },
];

/** Each customer who owes, by how late the money is, and a row for the whole shop. */
export function AgeingTable({ rows }: { rows: AgeingRow[] }) {
  const all: Line = {
    id: "total",
    name: "All customers",
    phone: "",
    total: sum(rows, (row) => row.total),
    buckets: Object.fromEntries(
      AGEING_BUCKETS.map((bucket) => [bucket, sum(rows, (row) => row.buckets[bucket]!)]),
    ),
    isTotal: true,
  };
  return (
    <DataTable
      label="Ageing"
      columns={columns}
      data={[...rows, all]}
      getRowId={(line) => line.id}
      className="min-h-0"
    />
  );
}
