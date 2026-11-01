import { StoreIcon } from "lucide-react";
import { CellLines, EmptyList } from "@shopper/backoffice/kit";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

export function NoTenants() {
  return (
    <EmptyList
      icon={StoreIcon}
      title="No shops yet"
      description="A shop appears here as soon as its owner verifies their email at signup."
    />
  );
}

// Two-line rows fill a tall laptop screen; the table clips what does not fit, as the loaded one scrolls it.
const SKELETON_ROWS = 14;

/** The heading with its count, then the table's card, header and rows, which fill what the page leaves. */
export function TenantsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Shops</h1>
        <Skeleton className="h-5 w-5" />
      </div>
      <DataTableSkeleton
        label="Loading shops"
        className="min-h-0"
        rows={SKELETON_ROWS}
        columns={[
          { header: "Shop", cell: <CellLines lines={["h-5 w-40", "h-4 w-24"]} /> },
          { header: "Onboarding", cell: <Skeleton className="h-5 w-20 rounded-full" /> },
          {
            header: "First sale",
            className: "hidden md:table-cell",
            cell: <Skeleton className="h-5 w-32" />,
          },
          { header: "Verification", cell: <Skeleton className="h-5 w-24 rounded-full" /> },
          { header: "Till updates", cell: <Skeleton className="h-8 w-28" /> },
          {
            header: "Joined",
            className: "hidden lg:table-cell",
            cell: <Skeleton className="h-5 w-32" />,
          },
        ]}
      />
    </div>
  );
}
