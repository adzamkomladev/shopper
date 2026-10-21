import { Skeleton } from "@shopper/ui/components/skeleton";
import { InventorySkeleton } from "../inventory/states";

const SKELETON_ROWS = 5;

/** Header and rows in the shape of the loaded table, so nothing jumps when it arrives. */
export function SuppliersTableSkeleton() {
  return (
    <div
      className="flex flex-col rounded-lg border"
      role="status"
      aria-busy="true"
      aria-label="Loading suppliers"
    >
      <Skeleton className="h-10 rounded-b-none" />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="ml-auto h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

export function SuppliersSkeleton() {
  return (
    <InventorySkeleton action>
      <SuppliersTableSkeleton />
    </InventorySkeleton>
  );
}
