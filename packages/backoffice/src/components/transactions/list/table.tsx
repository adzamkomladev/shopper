"use no memo";
import { Link } from "@tanstack/react-router";
import { money } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import type { TransactionRow } from "../../../schemas/transactions";
import { StatusBadge } from "../status";
import { occurredLabel, tendersLabel } from "./format";

// A phone keeps the receipt, status and total; a tablet adds the customer and tender; a laptop the rest.
export const FROM_MD = "hidden md:table-cell";
export const FROM_LG = "hidden lg:table-cell";

type Props = { rows: TransactionRow[]; oneDay: boolean; onEndReached: () => void };

/** Newest first; a sale's receipt opens its drill-down, a MoMo payment no sale used has none. */
export function TransactionTable({ rows, oneDay, onEndReached }: Props) {
  const columns: DataTableColumn<TransactionRow>[] = [
    {
      id: "receipt",
      header: "Time / receipt",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{occurredLabel(row.original.occurredAt, oneDay)}</span>
          {row.original.kind === "sale" ? (
            <Link
              to="/transactions/$saleId"
              params={{ saleId: row.original.id }}
              className="w-fit text-xs text-muted-foreground hover:underline focus-visible:underline"
            >
              {row.original.receiptNumber}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">MoMo payment</span>
          )}
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      meta: { className: FROM_MD },
      cell: ({ row }) => row.original.customerName ?? "Walk-in customer",
    },
    {
      id: "items",
      header: "Items",
      meta: { className: FROM_LG },
      cell: ({ row }) =>
        row.original.kind === "sale"
          ? `${row.original.items} ${row.original.items === 1 ? "item" : "items"}`
          : "—",
    },
    {
      id: "tender",
      header: "Payment",
      meta: { className: FROM_MD },
      cell: ({ row }) => tendersLabel(row.original.tenders),
    },
    {
      id: "cashier",
      header: "Cashier",
      meta: { className: FROM_LG },
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.cashierName ?? "—"}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "total",
      header: "Total",
      meta: { align: "right" },
      cell: ({ row }) => <Money amount={money(row.original.total)} className="font-semibold" />,
    },
  ];
  return (
    <DataTable
      label="Transactions"
      columns={columns}
      data={rows}
      getRowId={(row) => `${row.kind}-${row.id}`}
      onEndReached={onEndReached}
      className="min-h-0"
    />
  );
}
