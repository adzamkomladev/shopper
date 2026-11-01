import { ScrollTextIcon, SearchXIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { CellLines, EmptyList } from "../../admin/states";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";

// Two-line rows fill a tall laptop screen; the table clips what does not fit, as the loaded one scrolls it.
const AUDIT_ROWS = 14;

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

/** The table's place while the log loads: its card, header and rows, clipped like the loaded table is. */
export function AuditRowsSkeleton() {
  return (
    <DataTableSkeleton
      label="Loading the audit log"
      className="min-h-96"
      rows={AUDIT_ROWS}
      columns={[
        { header: "Action", cell: <CellLines lines={["h-5 w-36", "h-4 w-32"]} /> },
        { header: "Who", cell: <CellLines lines={["h-5 w-28", "h-4 w-20"]} /> },
        {
          header: "Where",
          className: "hidden md:table-cell",
          cell: <Skeleton className="h-5 w-24" />,
        },
        {
          header: "Approved by",
          className: "hidden lg:table-cell",
          cell: <Skeleton className="h-5 w-4" />,
        },
      ]}
    />
  );
}

/** The filters and table of the loaded tab, so nothing moves when the data arrives. */
export function AuditLogSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div
        role="presentation"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <AuditRowsSkeleton />
    </div>
  );
}
