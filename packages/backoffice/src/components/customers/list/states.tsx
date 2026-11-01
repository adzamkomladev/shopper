import { ArchiveIcon, BuildingIcon, SearchXIcon, UsersIcon, WalletIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import {
  DataTableSkeleton,
  type DataTableSkeletonColumn,
} from "@shopper/ui/components/table/skeleton";
import type { CustomersSearch } from "../../../queries/customers/types";
import { EmptyList } from "../../admin/states";
import { CustomersPage } from "../tabs";
import { FROM_MD } from "./table";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 16;

type Segment = CustomersSearch["segment"];

type NoCustomersProps = { segment: Segment; onAdd?: () => void };

/** The list has nobody in it: what the segment is for, and the way to add the first customer. */
export function NoCustomers({ segment, onAdd }: NoCustomersProps) {
  if (segment === "archived")
    return (
      <EmptyList
        icon={ArchiveIcon}
        title="No archived customers"
        description="A customer you archive or merge away stays here, out of the till's way."
      />
    );
  if (segment === "account")
    return (
      <EmptyList
        icon={WalletIcon}
        title="Nobody owes you"
        description="A customer who buys on account and has not paid it off shows here, with what they owe."
      />
    );
  const business = segment === "business";
  return (
    <EmptyList
      icon={business ? BuildingIcon : UsersIcon}
      title={business ? "No business customers" : "No customers yet"}
      description={
        business
          ? "A business has its own name and TIN, for invoices. Add one and it shows here."
          : "Add the people who buy from you. Once they are on a sale, their purchases and account follow them."
      }
    >
      {onAdd && (
        // The page's own Add customer button is the primary one.
        <Button aria-keyshortcuts="N" variant="outline" onClick={onAdd}>
          Add customer
        </Button>
      )}
    </EmptyList>
  );
}

/** A search found nobody. */
export function NoMatch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyList
      icon={SearchXIcon}
      title="No customers match"
      description={`Nobody found for "${query}". Check the spelling, or search by phone number.`}
    >
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </EmptyList>
  );
}

const COLUMNS: DataTableSkeletonColumn[] = [
  {
    header: "Customer",
    // A phone shows the customer's phone under the name, so the row is two lines there.
    cell: (
      <div className="flex items-center gap-3">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <div className="flex flex-col">
          <Skeleton className="my-0.5 h-4 w-40" />
          <Skeleton className="my-0.5 h-3 w-24 md:hidden" />
        </div>
      </div>
    ),
  },
  { header: "Phone", className: FROM_MD, cell: <Skeleton className="h-4 w-24" /> },
  { header: "Type", className: FROM_MD, cell: <Skeleton className="h-4 w-16" /> },
  { header: "Owed", className: "text-right", cell: <Skeleton className="ml-auto h-4 w-16" /> },
  {
    header: "Points",
    className: `${FROM_MD} text-right`,
    cell: <Skeleton className="ml-auto h-4 w-8" />,
  },
  {
    header: "Last visit",
    className: "hidden text-right lg:table-cell",
    cell: <Skeleton className="ml-auto h-4 w-16" />,
  },
];

export function TableSkeleton() {
  return (
    <DataTableSkeleton label="Loading customers" columns={COLUMNS} rows={SKELETON_ROWS} fill />
  );
}

/** The search and Download CSV boxes and the segments, then the table, so the table starts where it will. */
export function CustomersBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-8 min-w-0 flex-1 basis-64" />
        <Skeleton className="h-8 w-35.75" />
      </div>
      <Skeleton className="h-9 w-72 max-w-full" />
      <TableSkeleton />
    </div>
  );
}

/** The page's own heading and tabs with the button's box, then the body: the page as it loads. */
export function CustomersSkeleton() {
  return (
    <CustomersPage active="customers" action={<Skeleton className="h-8 w-29" />}>
      <CustomersBodySkeleton />
    </CustomersPage>
  );
}
