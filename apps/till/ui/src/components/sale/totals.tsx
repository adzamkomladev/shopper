import { Check } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import type { SaleTotals } from "../../sale/types";

const zero = money(0);
const emptyTotals: SaleTotals = {
  base: zero,
  vat: zero,
  nhil: zero,
  getfund: zero,
  covid: zero,
  gross: zero,
  roundingAdjustment: zero,
};

/** Figma "Cart total": what the prices include, then the total and how many lines make it. */
export function CartTotals({
  totals = emptyTotals,
  saved,
  count,
}: {
  totals: SaleTotals | undefined;
  saved: boolean;
  count: number;
}) {
  const included =
    totals.covid > 0 ? "VAT, NHIL, GETFund and COVID-19 levy" : "VAT, NHIL and GETFund";
  return (
    <div className="flex shrink-0 flex-col gap-2 px-2">
      <div className="flex min-h-5 items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <p>Prices include {included}.</p>
        {saved && (
          <p className="flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-4 text-success" />
            Saved on this register
          </p>
        )}
      </div>
      <dl className="flex items-center justify-between">
        <div>
          <dt className="text-lg font-medium">Total</dt>
          <dd className="text-sm text-muted-foreground">
            {count} item{count === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Amount due</dt>
          <dd className="text-lg font-medium tabular-nums">{formatGHS(totals.gross)}</dd>
        </div>
      </dl>
    </div>
  );
}
