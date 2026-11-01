import { Skeleton } from "@shopper/ui/components/skeleton";
import { DataTableSkeleton } from "@shopper/ui/components/table/skeleton";
import { RangeBarSkeleton } from "../range";
import { TileSkeleton } from "../tile";

const right = "text-right";

/** A titled block of the report: the heading, then a card holding the table or list. */
function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <Skeleton className="h-6 w-44" />
      {children}
    </section>
  );
}

export function ReportBodySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the report"
      className="flex flex-col gap-6"
      role="status"
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <TileSkeleton key={index} />
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionSkeleton>
          <DataTableSkeleton
            rows={3}
            columns={[
              { header: "Method", cell: <Skeleton className="h-5 w-28" /> },
              {
                header: "Taken",
                className: right,
                cell: <Skeleton className="ml-auto h-5 w-20" />,
              },
            ]}
          />
        </SectionSkeleton>
        <SectionSkeleton>
          <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card shadow-sm">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="px-4 py-3">
                <Skeleton className="h-5" />
              </li>
            ))}
          </ul>
        </SectionSkeleton>
      </div>
      <SectionSkeleton>
        <DataTableSkeleton
          rows={5}
          columns={[
            { header: "Product", cell: <Skeleton className="h-5 w-48" /> },
            { header: "Sold", className: right, cell: <Skeleton className="ml-auto h-5 w-10" /> },
            {
              header: "Amount",
              className: right,
              cell: <Skeleton className="ml-auto h-5 w-20" />,
            },
          ]}
        />
      </SectionSkeleton>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-6">
      <RangeBarSkeleton />
      <ReportBodySkeleton />
    </div>
  );
}
