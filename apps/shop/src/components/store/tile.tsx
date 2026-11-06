import { Link } from "@tanstack/react-router";
import { ShoppingBasket } from "lucide-react";
import { formatGHS } from "@shopper/money";
import type { StoreProduct } from "../../schemas/store";
import { QuickAdd } from "../cart/add";

/** What the price is for: "each" reads as nothing, a measured product reads "per kg". */
export const perUnit = (unit: string) => (unit === "each" ? null : `per ${unit}`);

/** A product's photo through the store's short redirect, or a calm placeholder in the same box. */
export function ProductPhoto({
  shop,
  assetId,
  name,
  eager = false,
  decorative = false,
  className = "",
}: {
  shop: string;
  assetId: string | null;
  name: string;
  eager?: boolean;
  /** In a tile the link already names the product, so the photo says nothing more. */
  decorative?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative aspect-square overflow-hidden bg-shop-glow/50 ${className}`}>
      {assetId ? (
        <img
          src={`/api/shop/${shop}/images/${assetId}`}
          alt={decorative ? "" : name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <ShoppingBasket aria-hidden className="absolute inset-0 m-auto size-1/3 text-primary/40" />
      )}
    </div>
  );
}

/** One product in the grid: photo, name, and the price the till charges at this branch now. */
export function ProductTile({
  shop,
  branchId,
  product,
  index,
}: {
  shop: string;
  branchId: string;
  product: StoreProduct;
  index: number;
}) {
  const unit = perUnit(product.baseUnit);
  return (
    <li
      className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs animate-in fade-in slide-in-from-bottom-2 fill-mode-both motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <Link
        to="/$shop/products/$id"
        params={{ shop, id: product.id }}
        search={{ branch: branchId }}
        className="group flex flex-1 flex-col outline-none transition hover:bg-shop-glow/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset motion-reduce:transition-none"
      >
        <ProductPhoto
          shop={shop}
          assetId={product.imageAssetId}
          name={product.name}
          eager={index < 4}
          decorative
        />
        <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
          <h3 className="line-clamp-2 font-semibold text-pretty">{product.name}</h3>
          <p className="mt-auto pt-1 text-lg font-extrabold tabular-nums">
            {formatGHS(product.price)}
            {unit ? (
              <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>
            ) : null}
          </p>
        </div>
      </Link>
      <QuickAdd shop={shop} product={product} />
    </li>
  );
}
