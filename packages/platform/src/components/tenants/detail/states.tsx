import { Skeleton } from "@shopper/ui/components/skeleton";
import { Section } from "../../kyb/review/details";

const STAT_TILES = 8;

/**
 * The shop's shape while it loads: the back link, name and joined line, the tab row, the headline tiles and one
 * section. The tab row's own labels need data, so it is a bar of the loaded row's height.
 */
export function TenantSkeleton() {
  return (
    <div
      className="flex max-w-5xl flex-col gap-6 pb-6"
      role="status"
      aria-busy="true"
      aria-label="Loading shop"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: STAT_TILES }, (_, index) => (
          <Skeleton key={index} className="h-19.5 rounded-lg" />
        ))}
      </div>
      <Section label="Owner and status">
        <Skeleton className="h-60 sm:h-28" />
      </Section>
    </div>
  );
}
