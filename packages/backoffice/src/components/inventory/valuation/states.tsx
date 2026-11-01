import { Link } from "@tanstack/react-router";
import { PackageOpenIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import { EmptyList } from "../../admin/states";
import { InventoryPage } from "../tabs";
import { FROM_MD } from "./table";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 16;

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Product",
    // A phone adds what is on hand and its cost under the name.
    cell: (
      <div className="flex flex-col">
        <Skeleton className="my-0.5 h-4 w-48" />
        <Skeleton className="my-0.5 h-3 w-28" />
      </div>
    ),
  },
  {
    header: "On hand",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  },
  {
    header: "Last unit cost",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  },
  { header: "Value", className: "text-right", cell: <Skeleton className="ml-auto h-4 w-20" /> },
  // Most lines carry no flag, so most flag cells are empty.
  { header: "Flags", className: FROM_MD, cell: null },
];

/** The summary cards and table as they load, under the branch picker, which is already there. */
export function ValuationResultsSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <Skeleton className="h-30.5" />
        <Skeleton className="h-30.5" />
      </div>
      <DataTableSkeleton
        label="Loading stock valuation lines"
        columns={COLUMNS}
        rows={SKELETON_ROWS}
        fill
      />
    </div>
  );
}

export function ValuationBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-8 w-full sm:w-48" />
      <ValuationResultsSkeleton />
    </div>
  );
}

export function ValuationSkeleton() {
  return (
    <InventoryPage active="valuation">
      <ValuationBodySkeleton />
    </InventoryPage>
  );
}

/** Nothing on hand to put a value on: where stock comes from. */
export function NothingToValue({
  branchId,
  branchName,
  canWrite,
}: {
  branchId: string;
  branchName: string;
  canWrite: boolean;
}) {
  return (
    <EmptyList
      icon={PackageOpenIcon}
      title="Nothing on hand to value"
      description={`There is no stock at ${branchName}. Once goods are received, their value is listed here.`}
    >
      {canWrite && (
        <Button asChild>
          <Link to="/stock/receive" search={{ branch: branchId }}>
            Receive goods
          </Link>
        </Button>
      )}
    </EmptyList>
  );
}
