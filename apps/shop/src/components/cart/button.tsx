import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { useCart } from "../../stores/cart";

/** The header's way to the cart, with how many lines are in it. The badge pops when that number changes. */
export function CartButton({ shop, branchId }: { shop: string; branchId: string }) {
  const lines = useCart(shop).length;
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative size-10 rounded-full hover:bg-shop-glow"
    >
      <Link
        to="/$shop/cart"
        params={{ shop }}
        search={{ branch: branchId }}
        aria-keyshortcuts="C"
        aria-label={lines ? `Cart, ${lines} ${lines === 1 ? "item" : "items"}` : "Cart, empty"}
      >
        <ShoppingBag aria-hidden className="size-5" />
        {lines ? (
          <span
            key={lines}
            aria-hidden
            className="absolute top-0.5 right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground tabular-nums motion-safe:animate-pop"
          >
            {lines}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
