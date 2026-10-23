import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { initials, KIND_LABELS } from "../../../lib/customers/format";
import type { CustomerView } from "../../../queries/customers/types";
import { Balance } from "../balance";

// A phone keeps the customer (with their phone beneath) and what they owe; the rest needs a tablet.
const FROM_MD = "hidden md:table-cell";

/** The customer as the Purchases table shows them (Figma 99:2496): a small initials avatar and the name. */
const columns: DataTableColumn<CustomerView>[] = [
  {
    id: "customer",
    header: "Customer",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => {
      const customer = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar size="sm" aria-hidden>
            <AvatarFallback className="text-foreground">{initials(customer.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/customers/$customerId"
                params={{ customerId: customer.id }}
                className="w-fit font-medium wrap-break-word hover:underline"
              >
                {customer.name}
              </Link>
              {customer.archivedAt && (
                <Badge variant="outline">{customer.mergedIntoId ? "Merged" : "Archived"}</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {customer.businessName}
              <span className="md:hidden">
                {customer.businessName && " · "}
                {customer.phone}
              </span>
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: "phone",
    header: "Phone",
    meta: { className: FROM_MD },
    cell: ({ row }) => <span className="tabular-nums">{row.original.phone}</span>,
  },
  {
    id: "type",
    header: "Type",
    meta: { className: FROM_MD },
    cell: ({ row }) => KIND_LABELS[row.original.kind],
  },
  {
    id: "owed",
    header: "Owed",
    meta: { align: "right" },
    cell: ({ row }) => <Balance balance={row.original.balance} />,
  },
  {
    id: "points",
    header: "Points",
    meta: { align: "right", className: FROM_MD },
    cell: ({ row }) => <span className="tabular-nums">{row.original.points}</span>,
  },
];

type Props = { customers: CustomerView[]; onEndReached: () => void };

export function CustomersTable({ customers, onEndReached }: Props) {
  return (
    <DataTable
      label="Customers"
      columns={columns}
      data={customers}
      getRowId={(customer) => customer.id}
      onEndReached={onEndReached}
      className="min-h-0"
    />
  );
}
