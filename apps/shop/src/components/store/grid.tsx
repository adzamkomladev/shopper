import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import type { StorePage } from "../../schemas/store";
import { ProductTile } from "./tile";

/** A page of products with paging below it, or what to do when the page is empty. */
export function ProductGrid({
  shop,
  result,
  q,
  onClear,
}: {
  shop: string;
  result: StorePage;
  q?: string;
  onClear: () => void;
}) {
  const branchId = result.branch.id;
  if (result.products.length === 0)
    return (
      <div className="flex flex-col items-center gap-4 rounded-panel border border-dashed bg-card px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-shop-glow text-primary">
          <PackageSearch aria-hidden className="size-6" />
        </span>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">
            {q ? `Nothing matches “${q}”` : `Nothing to buy at ${result.branch.name} yet`}
          </h2>
          <p className="text-pretty text-muted-foreground">
            {q
              ? "Check the spelling, or try a shorter word."
              : "Products show here once this branch has them in stock. Try another branch."}
          </p>
        </div>
        {q ? (
          <Button variant="outline" className="rounded-full" onClick={onClear}>
            Clear the search
          </Button>
        ) : null}
      </div>
    );
  return (
    <section aria-label="Products" className="space-y-6">
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        {result.total === 1 ? "1 product" : `${result.total} products`} at {result.branch.name}
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {result.products.map((product, index) => (
          <ProductTile
            key={product.id}
            shop={shop}
            branchId={branchId}
            product={product}
            index={index}
          />
        ))}
      </ul>
      {result.pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <PageLink page={result.page - 1} disabled={result.page <= 1} label="Previous">
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </PageLink>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            Page {result.page} of {result.pages}
          </span>
          <PageLink page={result.page + 1} disabled={result.page >= result.pages} label="Next">
            Next
            <ChevronRight aria-hidden className="size-4" />
          </PageLink>
        </nav>
      ) : null}
    </section>
  );
}

function PageLink({
  page,
  disabled,
  label,
  children,
}: {
  page: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled)
    return (
      <Button variant="outline" className="h-11 rounded-full" disabled aria-label={`${label} page`}>
        {children}
      </Button>
    );
  return (
    <Button asChild variant="outline" className="h-11 rounded-full bg-card">
      <Link
        to="."
        search={(previous: Record<string, unknown>) => ({ ...previous, page })}
        aria-label={`${label} page`}
      >
        {children}
      </Link>
    </Button>
  );
}
