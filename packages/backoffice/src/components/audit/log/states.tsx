import { ScrollTextIcon, SearchXIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { EmptyList } from "../../admin/states";

export function NoAuditEntries({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return filtered ? (
    <EmptyList
      icon={SearchXIcon}
      title="Nothing matches these filters"
      description="Widen the dates or clear a filter to see more of the log."
    >
      <Button variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </EmptyList>
  ) : (
    <EmptyList
      icon={ScrollTextIcon}
      title="Nothing has been recorded yet"
      description="Every change made in the back office or at a till shows here, with who made it and who approved it."
    />
  );
}

/** The table's place while the log loads: the header and rows of the loaded table. */
export function AuditRowsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the audit log"
      className="flex flex-col rounded-lg border"
    >
      <Skeleton className="h-10 rounded-b-none" />
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex h-16.5 items-center gap-6 border-t px-4">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="hidden h-9 w-32 md:block" />
          <Skeleton className="hidden h-6 w-28 lg:block" />
        </div>
      ))}
    </div>
  );
}

/** The filters and table of the loaded tab, so nothing moves when the data arrives. */
export function AuditLogSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div
        role="presentation"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <AuditRowsSkeleton />
    </div>
  );
}
