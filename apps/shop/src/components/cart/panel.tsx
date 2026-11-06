import { Link } from "@tanstack/react-router";
import { CircleAlert, ShoppingBasket, Trash2 } from "lucide-react";
import { formatGHS } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { setQuantity, type CartLine } from "../../stores/cart";
import type { CartQuote } from "../../schemas/checkout";
import { ProductPhoto } from "../store/tile";
import { quantityLabel, stepOf } from "./quantity";
import { QuantityStepper } from "./stepper";
import { ClearCart } from "./clear";
import { CartTotals } from "./totals";

/**
 * The cart, as the Web Flow checkout panel draws it: numbered lines with a stepper each, Clear cart, and the total
 * with its item count over the Checkout button. Prices are the server's quote, the same as the till's.
 */
export function CartPanel({
  shop,
  branchId,
  lines,
  quote,
  pricing,
}: {
  shop: string;
  branchId: string;
  lines: CartLine[];
  quote: CartQuote | undefined;
  pricing: boolean;
}) {
  if (!lines.length)
    return (
      <Empty className="rounded-panel border border-dashed bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingBasket aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Your cart is empty</EmptyTitle>
          <EmptyDescription>Add what you need from the store and it waits here.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="touch" className="rounded-full px-6 font-bold">
            <Link to="/$shop" params={{ shop }} search={{ branch: branchId }}>
              Browse the store
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  const blocked = quote?.lines.some((line) => line.problem) ?? false;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section aria-labelledby="cart-lines" className="rounded-panel border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 id="cart-lines" className="text-lg font-bold">
            Items
          </h2>
          <ClearCart shop={shop} />
        </div>
        <ol className="divide-y">
          {lines.map((line, index) => {
            const quoted = quote?.lines.find((row) => row.productId === line.productId);
            const name = quoted?.name ?? "Product";
            const unit = quoted?.baseUnit ?? "each";
            return (
              <li key={line.productId} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                <span
                  aria-hidden
                  className="w-5 pt-1 text-sm font-bold text-muted-foreground tabular-nums"
                >
                  {index + 1}
                </span>
                <ProductPhoto
                  shop={shop}
                  assetId={quoted?.imageAssetId ?? null}
                  name={name}
                  decorative
                  className="size-16 shrink-0 rounded-xl border sm:size-20"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-semibold text-pretty">{name}</h3>
                    <p className="font-extrabold tabular-nums">
                      {quoted?.tax ? formatGHS(quoted.tax.gross) : "—"}
                    </p>
                  </div>
                  {quoted?.tax ? (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatGHS(quoted.tax.unitPrice)} {unit === "each" ? "each" : `per ${unit}`}
                    </p>
                  ) : null}
                  {quoted?.problem ? (
                    <p className="flex items-start gap-1.5 text-sm font-semibold text-destructive">
                      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                      {quoted.problem === "short" && quoted.availableThousandths > 0
                        ? `Only ${quantityLabel(quoted.availableThousandths, unit)} left at ${quote?.branch.name}`
                        : `Not available at ${quote?.branch.name}`}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <QuantityStepper
                      name={name}
                      quantityThousandths={line.quantityThousandths}
                      baseUnit={unit}
                      step={stepOf(unit)}
                      onChange={(next) => setQuantity(shop, line.productId, next)}
                    />
                    {quoted?.problem === "short" && quoted.availableThousandths > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          setQuantity(shop, line.productId, quoted.availableThousandths)
                        }
                      >
                        Take {quantityLabel(quoted.availableThousandths, unit)}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto rounded-full text-muted-foreground"
                      aria-label={`Remove ${name}`}
                      onClick={() => setQuantity(shop, line.productId, 0)}
                    >
                      <Trash2 aria-hidden />
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <CartTotals quote={quote} pricing={pricing}>
        <Button
          asChild={!blocked && !!quote}
          size="touch"
          disabled={blocked || !quote}
          className="h-14 w-full rounded-2xl text-base font-bold"
        >
          {!blocked && quote ? (
            <Link to="/$shop/checkout" params={{ shop }} search={{ branch: branchId }}>
              Checkout
            </Link>
          ) : (
            <span>{blocked ? "Fix the flagged items to check out" : "Checkout"}</span>
          )}
        </Button>
      </CartTotals>
    </div>
  );
}
