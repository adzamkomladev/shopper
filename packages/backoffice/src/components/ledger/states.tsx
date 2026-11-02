import { BookOpenIcon } from "lucide-react";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Skeleton } from "@shopper/ui/components/skeleton";

const cell = (width: string, right = false) => (
  <Skeleton className={`h-4 ${width} ${right ? "ml-auto" : ""}`} />
);

/** The chart as it loads: the lock line, then the accounts table. */
export function ChartSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Skeleton className="h-5 w-64 max-w-full" />
      <DataTableSkeleton
        label="Loading the accounts"
        rows={14}
        columns={[
          { header: "Code", cell: cell("w-10") },
          { header: "Account", cell: cell("w-40") },
          { header: "Type", className: "hidden md:table-cell", cell: cell("w-16") },
          { header: "Balance", className: "text-right", cell: cell("w-24", true) },
        ]}
      />
    </div>
  );
}

/** A range of entries or lines as it loads, under range controls already drawn. */
export function LinesSkeleton({ label }: { label: string }) {
  return (
    <DataTableSkeleton
      label={label}
      rows={12}
      columns={[
        { header: "Date", cell: cell("w-20") },
        { header: "Entry", cell: cell("w-48") },
        { header: "Debit", className: "text-right", cell: cell("w-20", true) },
        { header: "Credit", className: "text-right", cell: cell("w-20", true) },
      ]}
    />
  );
}

/** The range controls and a table, for a whole ledger tab as it loads. */
export function RangeSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Skeleton className="h-14 w-44" />
        <Skeleton className="h-14 w-44" />
      </div>
      <LinesSkeleton label={label} />
    </div>
  );
}

export function NothingPosted({ what }: { what: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookOpenIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Nothing posted {what}</EmptyTitle>
        <EmptyDescription>
          Sales, refunds, stock and payments post here as the tills sync. Pick another range or post
          an entry.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
