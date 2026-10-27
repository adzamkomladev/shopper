import { Skeleton } from "@shopper/ui/components/skeleton";

const MEMBER_ROWS = 5;

/**
 * The Users screen while it loads: heading, the Members tabs and table, at the sizes they take loaded. Under lg the
 * members table fills the height the screen leaves it, so the block is fixed. Invitations are left out: they draw
 * below the members without moving them, and a skeleton taller than the screen would scroll with nothing to focus.
 */
export function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading users">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-32" />
      </div>
      <section className="flex flex-col gap-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-48" />
        <div className="flex h-96 flex-col overflow-hidden rounded-lg border lg:h-auto">
          <Skeleton className="h-10 shrink-0 rounded-b-none" />
          {Array.from({ length: MEMBER_ROWS }, (_, index) => (
            <div
              key={index}
              className="flex h-21.75 shrink-0 items-center gap-6 border-t px-4 lg:h-16.5"
            >
              <Skeleton className="h-5 w-56" />
              <Skeleton className="ml-auto h-8 w-28" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
