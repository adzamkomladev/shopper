import { ShieldCheckIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import type { Segment } from "../../../lib/kyc/types";
import { EmptyList } from "../../admin/states";
import { CustomersPage } from "../../customers/tabs";
import { FROM_LG, FROM_MD } from "./table";

const EMPTY: Record<Segment, { title: string; description: string }> = {
  review: {
    title: "Nothing is waiting for approval",
    description:
      "A check lands here once the customer's phone is verified and their ID, if any, is on file.",
  },
  open: {
    title: "No checks in progress",
    description:
      "A check stays open while it waits for the code to be entered or for the ID. Start one with the button above.",
  },
  closed: {
    title: "No closed checks yet",
    description: "Approved, rejected and expired checks are kept here.",
  },
};

export function NoChecks({ segment, children }: { segment: Segment; children?: React.ReactNode }) {
  return (
    <EmptyList icon={ShieldCheckIcon} {...EMPTY[segment]}>
      {children}
    </EmptyList>
  );
}

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 12;
const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Phone",
    cell: (
      <div className="flex flex-col">
        <Skeleton className="my-0.5 h-4 w-28" />
        <Skeleton className="my-0.5 h-3 w-14" />
      </div>
    ),
  },
  {
    header: "Asked for",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-20" />,
  },
  { header: "ID", className: FROM_LG, cell: <Skeleton className="h-4 w-44" /> },
  {
    header: "Status",
    cell: (
      <div className="flex flex-col items-start gap-1">
        <Skeleton className="h-5.5 w-24 rounded-full" />
        <Skeleton className="my-0.5 h-3 w-28" />
      </div>
    ),
  },
];

/** The page's own heading and tabs with the button's box, then the segments and the table: the page as it loads. */
export function KycQueueSkeleton() {
  return (
    <CustomersPage active="kyc" title="Identity checks" action={<Skeleton className="h-8 w-25" />}>
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <Skeleton className="h-9 w-72 max-w-full" />
        <DataTableSkeleton
          label="Loading identity checks"
          columns={COLUMNS}
          rows={SKELETON_ROWS}
          fill
        />
      </div>
    </CustomersPage>
  );
}
