import type { UseQueryResult } from "@tanstack/react-query";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { LoadError } from "../../register/states";

// A table's header and rows are 40px and 66px tall: the skeleton takes the same space as the first rows.
const SKELETON_ROWS = 4;

/** A table's header and a few rows while its data loads. */
export function PanelSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="flex shrink-0 flex-col overflow-hidden rounded-lg border"
    >
      <Skeleton className="h-10 shrink-0 rounded-b-none" />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex h-16.5 shrink-0 items-center gap-3 border-t px-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

type Props<T> = {
  query: UseQueryResult<T>;
  /** What is loading, for the skeleton and the error: "purchases". */
  what: string;
  children: (data: T) => React.ReactNode;
};

/** A tab's data: a skeleton while it loads, the error with Try again, then `children`. A failed refresh keeps what was shown. */
export function QueryPanel<T>({ query, what, children }: Props<T>) {
  if (query.isPending) return <PanelSkeleton label={`Loading ${what}`} />;
  if (query.isError && query.data === undefined)
    return <LoadError error={query.error} what={what} onRetry={() => void query.refetch()} />;
  return children(query.data as T);
}
