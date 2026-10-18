import { Skeleton } from "@shopper/ui/components/skeleton";
import { TileSkeleton } from "../tile";

export const tilesGrid = "grid gap-5 sm:grid-cols-2";
export const dashboardGrid = "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]";

export function TilesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading totals" className={tilesGrid} role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <TileSkeleton key={index} />
      ))}
    </div>
  );
}

/** The whole dashboard's shape: the range bar, four tiles and the quick actions. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-17 w-full max-w-xl" />
      <div className={dashboardGrid}>
        <TilesSkeleton />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
