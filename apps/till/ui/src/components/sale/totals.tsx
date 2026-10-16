import { Check } from "lucide-react";
import { add, formatGHS } from "@shopper/money";
import type { SaleTotals } from "../../sale/types";

/** Figma "Cart support" and "Cart totals": what the prices include, then subtotal, tax and total. */
export function CartTotals({ totals, saved }: { totals: SaleTotals; saved: boolean }) {
  const tax = [totals.vat, totals.nhil, totals.getfund, totals.covid].reduce(add);
  const included =
    totals.covid > 0 ? "VAT, NHIL, GETFund and COVID-19 levy" : "VAT, NHIL and GETFund";
  return (
    <div className="shrink-0">
      <div className="flex h-8 items-center justify-between px-5 text-xs font-medium text-muted-foreground">
        <p>Prices include {included}.</p>
        {saved && (
          <p className="flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-4 text-success" />
            Saved on this register
          </p>
        )}
      </div>
      <dl className="flex flex-col gap-1 border-t bg-muted/50 px-5 pt-2.5 pb-3 text-sm">
        <Row label="Subtotal" value={formatGHS(totals.base)} />
        <Row label="Tax" value={formatGHS(tax)} />
        <div className="my-1 h-px bg-border" />
        <div className="flex items-baseline justify-between font-bold text-foreground">
          <dt className="text-base">Total</dt>
          <dd className="text-2xl tracking-tight tabular-nums">{formatGHS(totals.gross)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
