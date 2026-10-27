import { formatGHS, money } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import type { ReportColumn } from "./types";

const FROM = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/** A report's rows, then its total row in bold: the same rows, in the same order, as the export. */
export function ReportTable<T>({
  label,
  columns,
  rows,
  total,
  rowId,
}: {
  label: string;
  columns: ReportColumn<T>[];
  rows: T[];
  total?: T;
  rowId: (row: T) => string;
}) {
  const data = [
    ...rows.map((value) => ({ value, total: false })),
    ...(total ? [{ value: total, total: true }] : []),
  ];
  const table: DataTableColumn<(typeof data)[number]>[] = columns.map((column) => ({
    id: column.id,
    header: column.header,
    meta: {
      align: column.figure ? "right" : undefined,
      className: column.phone ? "sm:hidden" : column.from && FROM[column.from],
    },
    cell: ({ row }) => (
      <span
        className={`${column.figure ? "tabular-nums whitespace-nowrap" : ""} ${row.original.total ? "font-semibold" : ""}`}
      >
        {column.cell(row.original.value)}
      </span>
    ),
  }));
  return (
    <DataTable
      label={label}
      columns={table}
      data={data}
      getRowId={(row) => (row.total ? "total" : rowId(row.value))}
      className="min-h-52"
    />
  );
}

/** An integer amount in 1/10000 cedi, as cedis. */
export const cash = (amount: number) => <Money amount={money(amount)} />;

/** The same amount as plain text, for a sentence or a figure tile. */
export const cedis = (amount: number) => formatGHS(money(amount));

/** Basis points as a percentage: 1234 → "12.34%". */
export const bps = (value: number) => `${(value / 100).toFixed(2)}%`;
