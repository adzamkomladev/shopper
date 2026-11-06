import { formatGHS } from "@shopper/money";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { add } from "@shopper/money";
import type { CartQuote } from "../../schemas/checkout";

/** The total and how it is made up, read out when it changes. `children` is the action under it. */
export function CartTotals({
  quote,
  pricing,
  children,
}: {
  quote: Pick<CartQuote, "totals" | "count" | "delivery"> | undefined;
  pricing: boolean;
  children?: React.ReactNode;
}) {
  const totals = quote?.totals;
  const levies = totals ? add(add(totals.nhil, totals.getfund), totals.covid) : null;
  return (
    <aside
      aria-labelledby="cart-total"
      className="space-y-4 rounded-panel border bg-card p-5 lg:sticky lg:top-20"
    >
      <dl className="space-y-2 text-sm" aria-busy={pricing || undefined}>
        {quote?.delivery ? <Row label="Delivery" value={formatGHS(quote.delivery.gross)} /> : null}
        <Row label="Before tax" value={totals ? formatGHS(totals.base) : null} />
        <Row label="VAT" value={totals ? formatGHS(totals.vat) : null} />
        <Row
          label="NHIL, GETFund and COVID levies"
          value={levies === null ? null : formatGHS(levies)}
        />
      </dl>
      <div aria-live="polite" className="flex items-end justify-between gap-3 border-t pt-4">
        <div>
          <p id="cart-total" className="text-lg font-bold">
            Total
          </p>
          <p className="text-sm text-muted-foreground">
            {quote ? `${quote.count} ${quote.count === 1 ? "item" : "items"}` : "Pricing your cart"}
          </p>
        </div>
        {totals ? (
          <p className="text-3xl font-black tabular-nums">{formatGHS(totals.gross)}</p>
        ) : (
          <Skeleton className="h-9 w-32" />
        )}
      </div>
      {children}
      <p className="text-xs text-muted-foreground">
        The shop's prices right now, the same as at the till. Tax is included.
      </p>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value ?? <Skeleton className="h-5 w-16" />}</dd>
    </div>
  );
}
