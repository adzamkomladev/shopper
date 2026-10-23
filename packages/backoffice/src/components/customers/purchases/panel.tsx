import { useQuery } from "@tanstack/react-query";
import { ReceiptIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { dayTime } from "../../../lib/customers/format";
import { customerSalesQuery } from "../../../queries/customers/account";
import type { CustomerSale } from "../../../schemas/customers/account";
import { EmptyList } from "../../admin/states";
import { QueryPanel } from "../detail/panel";

const columns: DataTableColumn<CustomerSale>[] = [
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => <span className="tabular-nums">{dayTime(row.original.occurredAt)}</span>,
  },
  {
    id: "receipt",
    header: "Receipt",
    meta: { className: "hidden sm:table-cell" },
    cell: ({ row }) =>
      row.original.receiptNumber ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "status",
    header: "Status",
    meta: { className: "hidden sm:table-cell" },
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    id: "total",
    header: "Total",
    meta: { align: "right" },
    cell: ({ row }) => <Money amount={row.original.total} className="font-medium" />,
  },
];

/** What they bought, newest first. */
export function PurchasesPanel({ customerId, name }: { customerId: string; name: string }) {
  const query = useQuery(customerSalesQuery(customerId));
  return (
    <QueryPanel query={query} what="purchases">
      {({ items }) =>
        items.length === 0 ? (
          <EmptyList
            icon={ReceiptIcon}
            title="No purchases yet"
            description={`Sales rung up to ${name} at a till show here, newest first.`}
          />
        ) : (
          <DataTable
            label="Purchases"
            columns={columns}
            data={items}
            getRowId={(sale) => sale.id}
            className="max-h-96"
          />
        )
      }
    </QueryPanel>
  );
}
