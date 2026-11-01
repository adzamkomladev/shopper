import { PackagePlusIcon } from "lucide-react";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";

/**
 * Same shape as the loaded page, as measured: back link, heading, the head card, search, the lines
 * and the footer. The head card is as tall as its fields stack in: Receive has three, Adjust two.
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
        <Skeleton className="h-7 w-32" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-64" />
          {/* The description wraps to two lines below a laptop. */}
          <Skeleton className="h-10 w-96 max-w-full lg:h-5" />
        </div>
      </div>
      <Skeleton
        className={fields === 3 ? "h-74 w-full sm:h-49 lg:h-24.25" : "h-44.25 w-full sm:h-24.25"}
      />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-46 w-full sm:h-58" />
      {/* Receive's total sits above its buttons on a phone. */}
      <Skeleton className={fields === 3 ? "h-19 w-full sm:h-8" : "h-8 w-full"} />
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
