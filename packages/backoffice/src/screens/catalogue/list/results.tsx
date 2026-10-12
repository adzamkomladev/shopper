import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { CircleAlertIcon } from "lucide-react";
import { EmptyCatalogue, NoMatch } from "./states";
import { ProductTable } from "./table";
import { productsQuery, type CategoryView, type ProductSearch } from "./queries";

type Props = {
  search: ProductSearch;
  categories: CategoryView[];
  addRef: React.Ref<HTMLButtonElement>;
  onAdd: () => void;
  onClear: () => void;
};

/** The part of the screen that waits for products: the table, or the state that stands in for it. */
export function ProductResults({ search, categories, addRef, onAdd, onClear }: Props) {
  const query = productsQuery(search);
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(query);
  const products = data.pages.flatMap((page) => page.items);
  if (products.length === 0) {
    return search.q || search.categoryId ? (
      <NoMatch query={search.q} onClear={onClear} />
    ) : (
      <EmptyCatalogue onAdd={onAdd} addRef={addRef} />
    );
  }
  return (
    <>
      <ProductTable
        // A new search starts the table over, including its "end reached" bookkeeping.
        key={query.queryKey.join("|")}
        products={products}
        categories={categories}
        onEndReached={() =>
          hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage()
        }
      />
      {isFetchNextPageError && (
        <Alert variant="destructive" className="flex items-center gap-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex-1">Couldn't load more products.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Retry
          </Button>
        </Alert>
      )}
      {isFetchingNextPage && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Loading more products…
        </p>
      )}
    </>
  );
}
