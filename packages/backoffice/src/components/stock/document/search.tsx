import { useState } from "react";
import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useDebouncedCallback } from "../../../hooks/debounced/callback";

const DEBOUNCE_MS = 200;

type Product = { productId: string; sku: string; name: string };
type Props<P extends Product> = {
  /** The input's id, so a line's Enter can send focus back here. */
  id: string;
  /** The products matching a search, from the register (till) or the shop's stock (portal). */
  query: (search: string) => UseQueryOptions<P[], Error, P[], string[]>;
  onPick: (product: P) => void;
  /** Whether the field is 44px tall, as on the till. */
  touch?: boolean;
  /** The key that jumps to this field, shown at its end. */
  shortcut?: string;
};

/** Name, SKU or barcode. Enter adds the first match, so a scanner (which types the code and Enter) works. */
export function ProductSearch<P extends Product>({
  id,
  query,
  onPick,
  touch = true,
  shortcut,
}: Props<P>) {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedCallback(setSearch, DEBOUNCE_MS);
  const queryClient = useQueryClient();
  const results = useQuery(query(search));
  const matches = search === text.trim() ? (results.data ?? []) : [];
  const pick = (product: P) => {
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
    const found = await queryClient.fetchQuery(query(code)).catch(() => []);
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
          className={shortcut ? "bg-card pr-10 pl-12" : "bg-card pl-12"}
          id={id}
          onChange={(event) => {
            setText(event.target.value);
            debounced(event.target.value.trim());
          }}
          onKeyDown={(event) => {
            // Escape empties the search first; with nothing typed it reaches the screen (which may go back).
            if (event.key === "Escape" && text) {
              event.stopPropagation();
              debounced.cancel();
              setText("");
              setSearch("");
            }
            if (event.key !== "Enter") return;
            event.preventDefault();
            void enter();
          }}
          placeholder="Scan barcode or search products"
          touch={touch}
          value={text}
        />
        {shortcut && (
          <Kbd aria-hidden className="absolute top-1/2 right-3 -translate-y-1/2">
            {shortcut}
          </Kbd>
        )}
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
