import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { stockListQuery } from "../../../../queries/inventory/stock";
import { NoMatch, NoProducts } from "./states";
import { StockTable } from "./table";

type Props = {
  branchId: string;
  branchName: string;
  q?: string;
  low?: true;
  onClear: () => void;
};

/** The part of the screen that waits for stock: the table, or the state that stands in for it. */
export function StockResults({ branchId, branchName, q, low, onClear }: Props) {
  const query = stockListQuery({ branchId, q, low });
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(query);
  const items = data.pages.flatMap((page) => page.items);
  if (items.length === 0)
    return q || low ? (
      <NoMatch query={q} low={!!low} branchName={branchName} onClear={onClear} />
    ) : (
      <NoProducts />
    );
  return (
    <>
      <StockTable
        // A new search starts the table over, including its "end reached" bookkeeping.
        key={query.queryKey.join("|")}
        items={items}
        branchId={branchId}
        onEndReached={() =>
          hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage()
        }
      />
      {isFetchNextPageError && (
        <Alert variant="destructive" className="flex items-center gap-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex-1">Couldn't load more stock.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Retry
          </Button>
        </Alert>
      )}
      {isFetchingNextPage && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Loading more stock…
        </p>
      )}
    </>
  );
}
