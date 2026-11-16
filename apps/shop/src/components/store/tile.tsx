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
    <div className={`relative aspect-square overflow-hidden bg-shop-glow ${className}`}>
      {assetId ? (
        <img
          src={`/api/shop/${shop}/images/${assetId}`}
          alt={decorative ? "" : name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <ShoppingBasket
          aria-hidden
          className="absolute inset-0 m-auto size-1/4 text-muted-foreground/40"
        />
      )}
    </div>
  );
}

/** One product in the grid: photo with the add button on it, then name and the till's price at this branch now. */
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
  const link = {
    to: "/$shop/products/$id",
    params: { shop, id: product.id },
    search: { branch: branchId },
  } as const;
  return (
    <li
      className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="relative">
        {/* The name below is the link a screen reader hears; the photo is the same link for a tap. */}
        <Link
          {...link}
          tabIndex={-1}
          aria-hidden
          className="group block overflow-hidden rounded-xl"
        >
          <ProductPhoto
            shop={shop}
            assetId={product.imageAssetId}
            name={product.name}
            eager={index < 4}
            decorative
            className="transition duration-300 group-hover:scale-103 motion-reduce:transition-none"
          />
        </Link>
        <div className="absolute right-2 bottom-2">
          <QuickAdd shop={shop} branchId={branchId} product={product} />
        </div>
      </div>
      <Link
        {...link}
        className="flex flex-col gap-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <h3 className="line-clamp-2 text-sm font-medium text-pretty sm:text-base">
          {product.name}
        </h3>
        <p className="font-semibold tabular-nums">
          {formatGHS(product.price)}
          {unit ? (
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          ) : null}
        </p>
      </Link>
    </li>
  );
}
