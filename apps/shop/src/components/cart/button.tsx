import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { useCart } from "../../stores/cart";

/** The header's way to the cart, with how many lines are in it. The page's `C` key goes to the same place. */
export function CartButton({ shop, branchId }: { shop: string; branchId: string }) {
  const lines = useCart(shop).length;
  return (
    <Button
      asChild
      variant="outline"
      className="relative h-11 rounded-full bg-card px-3 font-semibold sm:px-4"
    >
      <Link
        to="/$shop/cart"
        params={{ shop }}
        search={{ branch: branchId }}
        aria-keyshortcuts="C"
        aria-label={lines ? `Cart, ${lines} ${lines === 1 ? "item" : "items"}` : "Cart, empty"}
      >
        <ShoppingCart aria-hidden className="size-5" />
        <span className="hidden sm:inline">Cart</span>
        {lines ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground tabular-nums"
          >
            {lines}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
