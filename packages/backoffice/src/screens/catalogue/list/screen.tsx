import { Suspense, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { NewProductSheet } from "../../../components/catalogue/list/create/sheet";
import { TableSkeleton } from "../../../components/catalogue/list/states";
import { ProductResults } from "../../../components/catalogue/list/results";
import { ProductToolbar } from "../../../components/catalogue/list/toolbar";
import { categoriesQuery, productsQuery } from "../../../queries/catalogue/list";
import { useProductSearch } from "../../../hooks/catalogue/list/search";
import { useProductsShortcuts } from "../../../hooks/catalogue/list/shortcuts";

export function ProductsScreen() {
  const search = useSearch({ from: "/_shop/products" });
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  // The same query ProductResults suspends on. Read here without suspending, so the heading and
  // the toolbar stay mounted (and keep focus) while a new search loads.
  const { data: loaded } = useInfiniteQuery(productsQuery(search));
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const searchState = useProductSearch(search);
  const shortcuts = useProductsShortcuts({
    newProduct: () => setSheetOpen(true),
    focusSearch: () => searchRef.current?.focus(),
  });
  const isFiltered = Boolean(search.q || search.categoryId);
  const isEmptyCatalogue = !isFiltered && loaded?.pages[0]?.items.length === 0;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        {!isEmptyCatalogue && (
          <Button ref={addRef} onClick={() => setSheetOpen(true)}>
            Add product
            <Kbd aria-hidden>N</Kbd>
          </Button>
        )}
      </div>
      {!isEmptyCatalogue && (
        <ProductToolbar
          text={searchState.text}
          onTextChange={searchState.onTextChange}
          onCategoryChange={searchState.onCategoryChange}
          searchRef={searchRef}
          categories={categories}
          categoryId={search.categoryId}
        />
      )}
      <Suspense fallback={<TableSkeleton />}>
        <ProductResults
          search={search}
          categories={categories}
          addRef={addRef}
          onAdd={() => setSheetOpen(true)}
          onClear={searchState.clear}
        />
      </Suspense>
      <NewProductSheet open={sheetOpen} onOpenChange={setSheetOpen} addRef={addRef} />
    </div>
  );
}
