import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, ShoppingCart } from "lucide-react";
import { toast } from "@shopper/ui/components/sonner";
import { Button } from "@shopper/ui/components/button";
import { addToCart, setQuantity, useCart } from "../../stores/cart";
import { stepOf } from "./quantity";
import { QuantityStepper } from "./stepper";

/** The product page's add: choose how much, then add it; once it is in the basket, a way to the cart. */
export function AddToCart({
  shop,
  branchId,
  product,
}: {
  shop: string;
  branchId: string;
  product: { id: string; name: string; baseUnit: string };
}) {
  const step = stepOf(product.baseUnit);
  const [quantity, setQuantity] = useState(step);
  const inCart = useCart(shop).find((line) => line.productId === product.id);
  const added = useAddedToast(shop, branchId);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantityStepper
        name={product.name}
        quantityThousandths={quantity}
        baseUnit={product.baseUnit}
        step={step}
        onChange={(next) => setQuantity(Math.max(step, next))}
      />
      <Button
        type="button"
        size="touch"
        className="h-12 rounded-full px-6 text-base font-bold"
        onClick={() => {
          addToCart(shop, product.id, quantity);
          added(product.name);
        }}
      >
        <ShoppingCart aria-hidden />
        Add to cart
      </Button>
      {inCart ? (
        <Link
          to="/$shop/cart"
          params={{ shop }}
          search={{ branch: branchId }}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          View cart
        </Link>
      ) : null}
    </div>
  );
}

/** A tile's one-tap add of a single step; once the product is in the cart, a stepper takes its place. */
export function QuickAdd({
  shop,
  branchId,
  product,
}: {
  shop: string;
  branchId: string;
  product: { id: string; name: string; baseUnit: string };
}) {
  const step = stepOf(product.baseUnit);
  const line = useCart(shop).find((each) => each.productId === product.id);
  const added = useAddedToast(shop, branchId);
  // Add and the stepper swap places; the one that appears takes focus so the keyboard (and C, /) keeps working.
  const swapped = useRef(false);
  const takeFocus = useCallback((node: HTMLButtonElement | null) => {
    if (!node || !swapped.current) return;
    swapped.current = false;
    node.focus();
  }, []);
  if (line)
    return (
      <QuantityStepper
        name={product.name}
        quantityThousandths={line.quantityThousandths}
        baseUnit={product.baseUnit}
        step={step}
        onChange={(next) => {
          swapped.current = next <= 0;
          setQuantity(shop, product.id, next);
        }}
        className="shadow-md motion-safe:animate-pop"
        moreRef={takeFocus}
      />
    );
  return (
    <Button
      ref={takeFocus}
      type="button"
      size="icon"
      className="size-10 rounded-full shadow-md"
      aria-label={`Add ${product.name} to cart`}
      onClick={() => {
        swapped.current = true;
        addToCart(shop, product.id, step);
        added(product.name);
      }}
    >
      <Plus aria-hidden className="size-5" />
    </Button>
  );
}

/** Says what was added, with a way to the cart. */
function useAddedToast(shop: string, branchId: string) {
  const navigate = useNavigate();
  return (name: string) =>
    toast.success(`${name} added to your cart`, {
      action: {
        label: "View cart",
        onClick: () =>
          void navigate({ to: "/$shop/cart", params: { shop }, search: { branch: branchId } }),
      },
    });
}
