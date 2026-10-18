import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@shopper/ui/components/input";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { searchId } from "../../../lib/stock/lines";
import type { Kind } from "../../../lib/stock/types";
import { useDebouncedCallback } from "../../../hooks/debounced/callback";
import { productSearchQuery } from "../../../queries/stock/products";
import type { StockProduct } from "../../../schemas/stock/queue";

const DEBOUNCE_MS = 200;

/** Name, SKU or barcode. Enter adds the first match, so a scanner (which types the code and Enter) works. */
export function ProductSearch({
  kind,
  onPick,
}: {
  kind: Kind;
  onPick: (product: StockProduct) => void;
}) {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedCallback(setSearch, DEBOUNCE_MS);
  const queryClient = useQueryClient();
  const results = useQuery(productSearchQuery(search));
  const matches = search === text.trim() ? (results.data ?? []) : [];
  const pick = (product: StockProduct) => {
    onPick(product);
    debounced.cancel();
    setText("");
    setSearch("");
  };
  // A scanner types the whole code and Enter at once, before the search has debounced: ask now.
  async function enter() {
    const code = text.trim();
    if (!code) return;
    debounced.cancel();
    setSearch(code);
    const found = await queryClient.fetchQuery(productSearchQuery(code)).catch(() => []);
    if (found[0]) pick(found[0]);
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Scan barcode or search products"
          autoComplete="off"
          className="bg-card pl-12"
          id={searchId(kind)}
          onChange={(event) => {
            setText(event.target.value);
            debounced(event.target.value.trim());
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void enter();
          }}
          placeholder="Scan barcode or search products"
          touch
          value={text}
        />
      </div>
      {text.trim() && (
        <div aria-label="Matching products" className="rounded-xl border bg-card" role="group">
          {results.isError ? (
            <p className="p-4 text-sm text-destructive" role="alert">
              {results.error.message}
            </p>
          ) : search !== text.trim() || results.isFetching ? (
            <div
              aria-busy="true"
              aria-label="Searching"
              className="flex flex-col gap-2 p-3"
              role="status"
            >
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : matches.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No product matches "{search}".</p>
          ) : (
            <ul className="divide-y">
              {matches.map((product) => (
                <li key={product.productId}>
                  <button
                    className="outline-none focus-visible:focus-ring flex min-h-11 w-full items-center justify-between gap-4 px-4 py-2 text-left hover:bg-accent"
                    onClick={() => pick(product)}
                    type="button"
                  >
                    <span className="min-w-0 truncate font-medium">{product.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{product.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
