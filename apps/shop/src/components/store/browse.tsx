import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { pageRef } from "../shop/focus";
import type { StoreInfo, StorePage } from "../../schemas/store";
import { CategoryChips } from "./categories";
import { ProductGrid } from "./grid";
import { StoreHeader } from "./header";
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
      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-6 pb-16 sm:px-6">
        <h1 className={category ? "text-3xl font-black tracking-tight" : "sr-only"}>
          {category ? category.name : `${info.name} online`}
        </h1>
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
      </main>
    </div>
  );
}
