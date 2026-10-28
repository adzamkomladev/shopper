import { Link } from "@tanstack/react-router";
import { formatDate, shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import type { QueueItem } from "../../../schemas/types";

// A phone keeps the business and when it came in; a tablet adds the expiry; a laptop shows payouts.
export const FROM_MD = "hidden md:table-cell";
export const FROM_LG = "hidden lg:table-cell";

export function QueueTable({ cases }: { cases: QueueItem[] }) {
  const columns: DataTableColumn<QueueItem>[] = [
    {
      id: "business",
      header: "Business",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            to="/kyb/$orgId"
            params={{ orgId: row.original.orgId }}
            className="w-fit font-medium hover:underline"
          >
            {row.original.businessName ?? row.original.shop}
          </Link>
          <span className="text-xs text-muted-foreground">{row.original.shop}</span>
        </div>
      ),
    },
    {
      id: "submitted",
      header: "Submitted",
      cell: ({ row }) =>
        row.original.submittedAt ? shiftTime(row.original.submittedAt) : "Not yet",
    },
    {
      id: "expires",
      header: "Documents expire",
      meta: { className: FROM_MD },
      cell: ({ row }) =>
        row.original.expiresOn ? formatDate(row.original.expiresOn) : "No expiry",
    },
    {
      id: "payouts",
      header: "Payouts",
      meta: { className: FROM_LG },
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.payouts ? "Subaccount open" : "None yet"}</Badge>
      ),
    },
  ];
  return (
    <DataTable
      label="Business verifications"
      columns={columns}
      data={cases}
      getRowId={(item) => item.orgId}
      className="min-h-0"
    />
  );
}
