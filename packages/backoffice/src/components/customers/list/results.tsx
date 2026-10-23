import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { customersListQuery } from "../../../queries/customers/list";
import type { CustomersSearch } from "../../../queries/customers/types";
import { NoCustomers, NoMatch } from "./states";
import { CustomersTable } from "./table";

type Props = CustomersSearch & {
  onClear: () => void;
  /** Absent when the member cannot add customers. */
  onAdd?: () => void;
};

/** The part of the screen that waits for customers: the table, or the state that stands in for it. */
export function CustomersResults({ q, segment, onClear, onAdd }: Props) {
  const query = customersListQuery({
    q,
    archived: segment === "archived",
    business: segment === "business",
  });
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(query);
  const customers = data.pages.flatMap((page) => page.items);
  if (customers.length === 0)
    return q ? (
      <NoMatch query={q} onClear={onClear} />
    ) : (
      <NoCustomers segment={segment} onAdd={onAdd} />
    );
  return (
    <>
      <CustomersTable
        // A new search starts the table over, including its "end reached" bookkeeping.
        key={query.queryKey.join("|")}
        customers={customers}
        onEndReached={() =>
          hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage()
        }
      />
      {isFetchNextPageError && (
        <Alert variant="destructive" className="flex items-center gap-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex-1">Couldn't load more customers.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Retry
          </Button>
        </Alert>
      )}
      {isFetchingNextPage && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Loading more customers…
        </p>
      )}
    </>
  );
}
