"use no memo";
import { Link } from "@tanstack/react-router";
import { money } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import type { OrderRow } from "../../../schemas/orders";
import { slotLabel, untilSlot } from "../format";
import { OrderStatusBadge } from "../status";

// A phone keeps the order, slot and status; a tablet adds the customer; a laptop the rest.
const FROM_MD = "hidden md:table-cell";
const FROM_LG = "hidden lg:table-cell";
export const ORDER_COLUMN_CLASSES = { md: FROM_MD, lg: FROM_LG };

/** The orders of one stage, soonest slot first; an order's number opens it for picking. */
export function OrderTable({ rows, now }: { rows: OrderRow[]; now: Date }) {
  const columns: DataTableColumn<OrderRow>[] = [
    {
      id: "order",
      header: "Order",
      cell: ({ row }) => (
        <Link
          to="/orders/$orderId"
          params={{ orderId: row.original.id }}
          className="w-fit font-medium hover:underline focus-visible:underline"
        >
          #{row.original.number}
        </Link>
      ),
    },
    {
      id: "slot",
      header: "Slot",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{slotLabel(row.original.slotStart, row.original.slotEnd, now)}</span>
          <span className="text-xs text-muted-foreground">
            {untilSlot(row.original.slotStart, now)}
          </span>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      meta: { className: FROM_MD },
      cell: ({ row }) => row.original.customerName,
    },
    {
      id: "how",
      header: "Handover",
      meta: { className: FROM_LG },
      cell: ({ row }) =>
        row.original.fulfilment === "pickup" ? `Pickup · ${row.original.branch.name}` : "Delivery",
    },
    {
      id: "items",
      header: "Items",
      meta: { className: FROM_LG },
      cell: ({ row }) => `${row.original.items} ${row.original.items === 1 ? "item" : "items"}`,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      id: "total",
      header: "Total",
      meta: { align: "right" },
      cell: ({ row }) => <Money amount={money(row.original.gross)} className="font-semibold" />,
    },
  ];
  return (
    <DataTable
      label="Online orders"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      className="min-h-0"
    />
  );
}
