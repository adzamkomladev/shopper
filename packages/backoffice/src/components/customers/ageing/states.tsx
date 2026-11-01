import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import { AGEING_BUCKETS } from "../../../schemas/customers/account";
import { CustomersPage } from "../tabs";
import { BUCKET_LABELS } from "./table";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 12;

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Customer",
    cell: (
      <div className="flex flex-col">
        <Skeleton className="my-0.5 h-4 w-40" />
        <Skeleton className="my-0.5 h-3 w-24" />
      </div>
    ),
  },
  ...AGEING_BUCKETS.map((bucket): DataTableSkeletonColumn => ({
    header: BUCKET_LABELS[bucket],
    className: "hidden text-right md:table-cell",
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  })),
  { header: "Owed", className: "text-right", cell: <Skeleton className="ml-auto h-4 w-20" /> },
];

export function AgeingTableSkeleton() {
  return <DataTableSkeleton label="Loading ageing" columns={COLUMNS} rows={SKELETON_ROWS} fill />;
}

/** The table's box, where the table will be. */
export function AgeingBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <AgeingTableSkeleton />
    </div>
  );
}

/** The page's own heading and tabs with the Download CSV button's box, then the body: the page as it loads. */
export function AgeingSkeleton() {
  return (
    <CustomersPage active="ageing" action={<Skeleton className="h-8 w-35.75" />}>
      <AgeingBodySkeleton />
    </CustomersPage>
  );
}
