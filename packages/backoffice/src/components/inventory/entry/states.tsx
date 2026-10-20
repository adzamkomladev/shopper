import { PackagePlusIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";

/**
 * Same shape as the loaded page: back link, heading, the head card, search and the lines. The head
 * card is as tall as `fields` fields stack in: Receive has three, Adjust two.
 */
export function EntrySkeleton({ fields = 3 }: { fields?: 2 | 3 }) {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading the form"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-36" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
      </div>
      <Skeleton
        className={fields === 3 ? "h-67 w-full sm:h-46.25 lg:h-25.25" : "h-46.25 w-full sm:h-25.25"}
      />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-47 w-full sm:h-59" />
    </div>
  );
}

/** No products on the document yet: what to do to add one. */
export function NoLines() {
  return (
    <EmptyList
      icon={PackagePlusIcon}
      title="No products yet"
      description="Scan a barcode or search by name or SKU above, then enter the quantity."
    />
  );
}

export const AdjustSkeleton = () => <EntrySkeleton fields={2} />;
