import { Link } from "@tanstack/react-router";
import { shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { STATUS_LABELS, statusVariant } from "../../../lib/kyb/status";
import type { Tenant } from "../../../schemas/types";

// A phone keeps the shop and where it stands; a tablet adds the first sale; a laptop shows when it joined.
export const FROM_MD = "hidden md:table-cell";
export const FROM_LG = "hidden lg:table-cell";

export function TenantsTable({ tenants }: { tenants: Tenant[] }) {
  const columns: DataTableColumn<Tenant>[] = [
    {
      id: "shop",
      header: "Shop",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.code ?? "No code"}</span>
        </div>
      ),
    },
    {
      id: "onboarding",
      header: "Onboarding",
      // A shop made before onboarding was tracked has no record of it.
      cell: ({ row }) =>
        row.original.onboarding ? (
          <Badge variant={row.original.onboarding === "trading" ? "secondary" : "outline"}>
            {row.original.onboarding === "trading" ? "Trading" : "Setting up"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Not tracked</span>
        ),
    },
    {
      id: "firstSale",
      header: "First sale",
      meta: { className: FROM_MD },
      cell: ({ row }) =>
        row.original.firstSaleAt ? shiftTime(row.original.firstSaleAt) : "None yet",
    },
    {
      id: "kyb",
      header: "Verification",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) =>
        row.original.kybStatus ? (
          <Link
            to="/kyb/$orgId"
            params={{ orgId: row.original.id }}
            className="w-fit rounded-full hover:underline"
          >
            <Badge variant={statusVariant(row.original.kybStatus)}>
              {STATUS_LABELS[row.original.kybStatus]}
            </Badge>
          </Link>
        ) : (
          <span className="text-muted-foreground">Not started</span>
        ),
    },
    {
      id: "joined",
      header: "Joined",
      meta: { className: FROM_LG },
      cell: ({ row }) => shiftTime(row.original.createdAt),
    },
  ];
  return (
    <DataTable
      label="Shops"
      columns={columns}
      data={tenants}
      getRowId={(tenant) => tenant.id}
      className="min-h-0"
    />
  );
}
