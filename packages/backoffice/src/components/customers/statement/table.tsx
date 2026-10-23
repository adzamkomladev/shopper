import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import type { Money as MoneyAmount } from "@shopper/money";
import { dayTime, ENTRY_LABELS, fullDay } from "../../../lib/customers/format";
import type { StatementView } from "../../../schemas/customers/account";

const METHODS: Record<string, string> = { cash: "Cash", momo: "Mobile money" };

/** An entry, or the opening or closing balance, as one row of the statement. */
type Line = {
  id: string;
  when: string;
  label: string;
  note?: string;
  amount?: MoneyAmount;
  balance: MoneyAmount;
  total?: boolean;
};

const columns: DataTableColumn<Line>[] = [
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => <span className="tabular-nums">{row.original.when}</span>,
  },
  {
    id: "what",
    header: "What happened",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className={row.original.total ? "font-semibold" : undefined}>
          {row.original.label}
        </span>
        {row.original.note && (
          <span className="text-xs text-muted-foreground wrap-break-word">{row.original.note}</span>
        )}
      </div>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => row.original.amount !== undefined && <Money amount={row.original.amount} />,
  },
  {
    id: "balance",
    header: "Balance",
    meta: { align: "right" },
    cell: ({ row }) => (
      <Money
        amount={row.original.balance}
        className={row.original.total ? "font-semibold" : "font-medium"}
      />
    ),
  },
];

const lines = ({ from, to, opening, closing, entries }: StatementView): Line[] => [
  { id: "opening", when: fullDay(from), label: "Opening balance", balance: opening, total: true },
  ...entries.map((entry) => ({
    id: entry.id,
    when: dayTime(entry.occurredAt),
    label: ENTRY_LABELS[entry.kind] ?? entry.kind,
    note: [entry.method && METHODS[entry.method], entry.reason].filter(Boolean).join(" · "),
    amount: entry.amount,
    balance: entry.balance,
  })),
  { id: "closing", when: fullDay(to), label: "Closing balance", balance: closing, total: true },
];

/** Opening balance, the entries with the balance after each, and the closing balance. */
export function StatementTable({ statement }: { statement: StatementView }) {
  return (
    <div className="flex flex-col gap-2">
      <DataTable
        label="Statement"
        columns={columns}
        data={lines(statement)}
        getRowId={(line) => line.id}
        className="max-h-96"
      />
      <p className="text-xs text-muted-foreground">
        A positive balance is owed. A negative one is a deposit held for them.
      </p>
    </div>
  );
}
