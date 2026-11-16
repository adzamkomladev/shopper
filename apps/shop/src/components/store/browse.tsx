import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { pageRef } from "../shop/focus";
import type { StoreInfo, StorePage } from "../../schemas/store";
import { CategoryChips } from "./categories";
import { ProductGrid } from "./grid";
import { StoreFooter } from "./footer";
import { StoreHeader } from "./header";
import { StoreReviews } from "./reviews";
import { StoreSearch } from "./search";

/** A page of the store: the bar, search, categories and the products, for the whole store or one category. */
export function StoreBrowse({
  shop,
  info,
  result,
  q,
  category,
}: {
  shop: string;
  info: StoreInfo;
  result: StorePage;
  q?: string;
  category?: { id: string; name: string };
}) {
  const navigate = useNavigate();
  const search = useRef<HTMLInputElement>(null);
  const branchId = result.branch.id;
  const shortcuts = useShortcuts({
    "/": () => search.current?.focus(),
    C: () => void navigate({ to: "/$shop/cart", params: { shop }, search: { branch: branchId } }),
  });
  return (
    <div ref={pageRef(shortcuts)} tabIndex={-1} className="min-h-dvh outline-none">
      <StoreHeader shop={shop} info={info} branchId={branchId} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {category ? category.name : `Shop ${info.name}`}
          </h1>
          {category ? null : (
            <p className="text-pretty text-muted-foreground">
              Everyday groceries from {result.branch.name}, at the same prices as in store.
            </p>
          )}
        </div>
        <StoreSearch q={q} branchId={branchId} inputRef={search} />
        <CategoryChips
          shop={shop}
          categories={info.categories}
          active={category?.id}
          branchId={branchId}
        />
        <ProductGrid
          shop={shop}
          result={result}
          q={q}
          onClear={() => void navigate({ to: ".", search: { branch: branchId } })}
        />
        {q || category ? null : <StoreReviews shop={shop} />}
      </main>
      <StoreFooter shop={shop} name={info.name} branchId={branchId} />
    </div>
  );
}
