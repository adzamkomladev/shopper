import { BuildingIcon, ArchiveIcon, SearchXIcon, UsersIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";

// More rows than any window shows: the table fills the space the loaded one will, and the rest is clipped.
const SKELETON_ROWS = 12;

type Segment = "business" | "archived" | undefined;

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
        <Button variant="outline" onClick={onAdd}>
          Add customer
          <Kbd aria-hidden>N</Kbd>
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

export function TableSkeleton() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="Loading customers"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
    >
      <Skeleton className="h-10 shrink-0 rounded-b-none" />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex h-16.5 shrink-0 items-center gap-3 border-t px-4">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** The segments and the search box's own boxes, then the rows, so the table starts where it will. */
export function CustomersBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 min-w-0 flex-1 basis-64" />
        <Skeleton className="h-9 w-43.75" />
      </div>
      <Skeleton className="h-9 w-72 max-w-full" />
      <TableSkeleton />
    </div>
  );
}

/** The heading, tab and Add customer button, then the body: the page as it loads. */
export function CustomersSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <Skeleton className="h-9 w-40" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-38" />
      </div>
      <CustomersBodySkeleton />
    </div>
  );
}
