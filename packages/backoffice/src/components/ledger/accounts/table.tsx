import { Link } from "@tanstack/react-router";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { money } from "@shopper/money";
import type { ChartRow } from "../../../schemas/ledger/views";
import { TYPE_LABELS } from "../labels";

type Props = { rows: ChartRow[]; onEdit?: (row: ChartRow, trigger: string) => void };

/** The chart in code order, each balance on its natural side: debits for assets and expenses, credits otherwise. */
export function AccountsTable({ rows, onEdit }: Props) {
  const columns: DataTableColumn<ChartRow>[] = [
    {
      id: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.code}</span>,
    },
    {
      id: "name",
      header: "Account",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/ledger/accounts/$id"
            params={{ id: row.original.id }}
            className="font-medium underline-offset-4 hover:underline focus-visible:underline"
          >
            {row.original.name}
          </Link>
          {row.original.archived && <Badge variant="secondary">Archived</Badge>}
          {!row.original.systemKey && <Badge variant="outline">Custom</Badge>}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => TYPE_LABELS[row.original.type],
    },
    {
      id: "balance",
      header: "Balance",
      meta: { align: "right" },
      cell: ({ row }) => <Money amount={natural(row.original)} />,
    },
    ...(onEdit
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            meta: { align: "right" as const },
            cell: ({ row }: { row: { original: ChartRow } }) => (
              <button
                id={`edit-account-${row.original.id}`}
                type="button"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
                onClick={() => onEdit(row.original, `edit-account-${row.original.id}`)}
              >
                Edit<span className="sr-only"> {row.original.name}</span>
              </button>
            ),
          },
        ]
      : []),
  ];
  return <DataTable label="Accounts" columns={columns} data={rows} getRowId={(row) => row.id} />;
}

/** A balance as the account carries it: a credit balance on a liability, equity or income account reads positive. */
export const natural = (row: { type: ChartRow["type"]; balance: number }) =>
  money(row.type === "asset" || row.type === "expense" ? row.balance : -row.balance);
