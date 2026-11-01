import type { UseQueryResult } from "@tanstack/react-query";
import { LoadError } from "../../register/states";

type Props<T> = {
  query: UseQueryResult<T>;
  /** What is loading, for the error: "purchases". */
  what: string;
  /** The panel as it loads, drawn from the loaded panel's own layout. */
  skeleton: React.ReactNode;
  children: (data: T) => React.ReactNode;
};

/** A tab's data: a skeleton while it loads, the error with Try again, then `children`. A failed refresh keeps what was shown. */
export function QueryPanel<T>({ query, what, skeleton, children }: Props<T>) {
  if (query.isPending) return skeleton;
  if (query.isError && query.data === undefined)
    return <LoadError error={query.error} what={what} onRetry={() => void query.refetch()} />;
  return children(query.data as T);
}
