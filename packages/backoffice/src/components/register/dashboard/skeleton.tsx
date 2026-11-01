import { Separator } from "@shopper/ui/components/separator";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { RangeBarSkeleton } from "../range";
import { TileSkeleton } from "../tile";

export const tilesGrid = "grid gap-5 sm:grid-cols-2 xl:grid-cols-3";
export const dashboardGrid = "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]";

export function TilesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading totals" className={tilesGrid} role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <TileSkeleton key={index} />
      ))}
    </div>
  );
}

/** Quick Actions' own card: heading and lead, then a row per tab the member can open. */
function QuickActionsSkeleton() {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-1.5 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <Separator />
      <ul className="flex flex-col gap-2 p-4">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-20 rounded-xl" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The whole dashboard's shape: the range bar, six tiles and the quick actions. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-6">
      <RangeBarSkeleton />
      <div className={dashboardGrid}>
        <TilesSkeleton />
        <QuickActionsSkeleton />
      </div>
    </div>
  );
}
