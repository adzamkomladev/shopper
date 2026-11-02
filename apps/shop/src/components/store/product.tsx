import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CircleCheck, CircleSlash } from "lucide-react";
import { formatGHS } from "@shopper/money";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { pageRef } from "../shop/focus";
import type { StoreInfo, StoreItem } from "../../schemas/store";
import { StoreHeader } from "./header";
import { perUnit, ProductPhoto } from "./tile";

/** A product: its photo, the till's price at the branch now, and whether that branch can sell it. Esc goes back. */
export function ProductPage({
  shop,
  info,
  item,
}: {
  shop: string;
  info: StoreInfo;
  item: StoreItem;
}) {
  const navigate = useNavigate();
  const product = item.product;
  const branchId = item.branch.id;
  const unit = perUnit(product.baseUnit);
  const shortcuts = useShortcuts({
    Escape: () => void navigate({ to: "/$shop", params: { shop }, search: { branch: branchId } }),
  });
  return (
    <div ref={pageRef(shortcuts)} tabIndex={-1} className="min-h-dvh outline-none">
      <StoreHeader shop={shop} info={info} branchId={branchId} />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6">
        <Link
          to="/$shop"
          params={{ shop }}
          search={{ branch: branchId }}
          aria-keyshortcuts="Escape"
          className="inline-flex h-10 items-center gap-2 rounded-full pr-3 font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to the store
        </Link>
        <article className="mt-4 grid gap-6 md:grid-cols-2 md:gap-10">
          <ProductPhoto
            shop={shop}
            assetId={product.imageAssetId}
            name={product.name}
            eager
            className="rounded-panel border"
          />
          <div className="flex flex-col gap-5 md:py-4">
            {product.categoryId && product.categoryName ? (
              <Link
                to="/$shop/categories/$id"
                params={{ shop, id: product.categoryId }}
                search={{ branch: branchId }}
                className="w-fit text-sm font-bold tracking-wide text-primary uppercase hover:underline"
              >
                {product.categoryName}
              </Link>
            ) : null}
            <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">
              {product.name}
            </h1>
            {product.price === null ? null : (
              <p className="text-3xl font-extrabold tabular-nums">
                {formatGHS(product.price)}
                {unit ? (
                  <span className="ml-2 text-base font-medium text-muted-foreground">{unit}</span>
                ) : null}
              </p>
            )}
            {product.available ? (
              <p className="flex w-fit items-center gap-2 rounded-full bg-shop-glow px-4 py-2 font-semibold text-shop-ink">
                <CircleCheck aria-hidden className="size-5 text-primary" />
                In stock at {item.branch.name}
              </p>
            ) : (
              <div className="space-y-1 rounded-2xl border border-dashed bg-card p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <CircleSlash aria-hidden className="size-5 text-muted-foreground" />
                  Not available at {item.branch.name}
                </p>
                <p className="text-pretty text-muted-foreground">
                  {info.branches.length > 1
                    ? "Pick another branch at the top to see if it has it."
                    : "Check back soon: it shows here again once it is in stock."}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Prices are the shop's prices at {item.branch.name} right now, the same as at the till.
              SKU {product.sku}
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
