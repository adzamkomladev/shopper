import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { toast } from "@shopper/ui/components/sonner";
import { Button } from "@shopper/ui/components/button";
import { addToCart, useCart } from "../../stores/cart";
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
          toast.success(`${product.name} is in your cart`);
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

/** A tile's one-tap add of a single step. */
export function QuickAdd({
  shop,
  product,
}: {
  shop: string;
  product: { id: string; name: string; baseUnit: string };
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="m-3 mt-0 rounded-full font-semibold sm:m-4 sm:mt-0"
      aria-label={`Add ${product.name} to cart`}
      onClick={() => {
        addToCart(shop, product.id, stepOf(product.baseUnit));
        toast.success(`${product.name} is in your cart`);
      }}
    >
      <ShoppingCart aria-hidden />
      Add
    </Button>
  );
}
