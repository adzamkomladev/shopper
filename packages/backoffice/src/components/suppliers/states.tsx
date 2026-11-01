import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import { InventoryPage } from "../inventory/tabs";
import { FROM_LG, FROM_MD } from "./table";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 16;

const COLUMNS: DataTableSkeletonColumn[] = [
  { header: "Supplier", cell: <Skeleton className="h-4 w-48" /> },
  { header: "Phone", className: FROM_MD, cell: <Skeleton className="h-4 w-24" /> },
  { header: "Email", className: FROM_LG, cell: <Skeleton className="h-4 w-40" /> },
  { header: "TIN", className: FROM_LG, cell: <Skeleton className="h-4 w-28" /> },
  { header: "Actions", srOnly: true, cell: <Skeleton className="ml-auto h-7 w-11" /> },
];

/** Header and rows in the shape of the loaded table, so nothing jumps when it arrives. */
export function SuppliersTableSkeleton() {
  return (
    <DataTableSkeleton label="Loading suppliers" columns={COLUMNS} rows={SKELETON_ROWS} fill />
  );
}

export function SuppliersSkeleton() {
  return (
    <InventoryPage active="suppliers" action={<Skeleton className="h-8 w-26.75" />}>
      <SuppliersTableSkeleton />
    </InventoryPage>
  );
}
