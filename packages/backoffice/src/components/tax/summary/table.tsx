import { add, money, sub, type Money as Amount } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import type { TaxSummaryView } from "../../../schemas/tax/returns";

type Row = TaxSummaryView["rows"][number];
const FROM_MD = "hidden md:table-cell";
const CLASS = { standard: "Standard", "zero-rated": "Zero-rated", exempt: "Exempt" } as const;

/** VAT and the levies together: what a line or a credit note charged or gave back. */
const taxOf = (parts: Row["sales"]) =>
  [parts.vat, parts.nhil, parts.getfund, parts.covid]
    .map((part) => money(part))
    .reduce(add, money(0));

const cash = (amount: Amount, className?: string) => (
  <Money amount={amount} className={className} />
);

const columns: DataTableColumn<Row>[] = [
  {
    id: "period",
    header: "Period",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium tabular-nums">{row.original.period}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.branchName} · {CLASS[row.original.taxClass]}
        </span>
      </div>
    ),
  },
  {
    id: "value",
    header: "Sales before tax",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) => cash(money(row.original.sales.base)),
  },
  {
    id: "vat",
    header: "VAT",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) => cash(money(row.original.sales.vat)),
  },
  {
    id: "levies",
    header: "NHIL + GETFund",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) => cash(add(money(row.original.sales.nhil), money(row.original.sales.getfund))),
  },
  {
    id: "credits",
    header: "Credit notes",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) => cash(sub(money(0), taxOf(row.original.creditNotes))),
  },
  {
    id: "net",
    header: "Net tax",
    meta: { align: "right" },
    cell: ({ row }) =>
      cash(sub(taxOf(row.original.sales), taxOf(row.original.creditNotes)), "font-medium"),
  },
];

/** Totals over the range: tax charged, tax given back on credit notes, and what is left. */
export function SummaryTotals({ rows }: { rows: Row[] }) {
  const charged = rows.map((row) => taxOf(row.sales)).reduce(add, money(0));
  const returned = rows.map((row) => taxOf(row.creditNotes)).reduce(add, money(0));
  const tiles = [
    ["Tax charged", charged],
    ["Given back on credit notes", returned],
    ["Net tax", sub(charged, returned)],
  ] as const;
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {tiles.map(([label, amount]) => (
        <div key={label} className="rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold whitespace-nowrap">{cash(amount)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SummaryTable({ rows }: { rows: Row[] }) {
  return (
    <DataTable
      label="Tax by period, branch and class"
      columns={columns}
      data={rows}
      getRowId={(row) => `${row.period}|${row.branchId}|${row.taxClass}`}
      className="min-h-52"
    />
  );
}
