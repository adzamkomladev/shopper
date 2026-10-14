import { CreditCard } from "lucide-react";
import { formatGHS, type Money } from "@shopper/money";
import { isPriced } from "../../sale/rows";
import type { Row } from "../../sale/types";
import type { SaleTotals, TaxRates } from "../../sale/types";

/** 250 -> "2.5%", 1500 -> "15%". Integer maths only. */
export function formatBps(bps: number) {
  const fraction = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${Math.trunc(bps / 100)}${fraction ? `.${fraction}` : ""}%`;
}

/**
 * Figma "Payment workspace", rebuilt as a Ghana tax summary: the balance block shows the basket
 * gross, the keypad and methods become the tax lines, and the pay button becomes a notice.
 */
export function TaxSummary({
  rows,
  totals,
  className,
}: {
  rows: Row[];
  totals: SaleTotals;
  className?: string;
}) {
  const rates = rows.find(isPriced)?.tax.rule;
  const items = rows.length;
  const lines: {
    key: string;
    label: string;
    amount: Money;
    rate?: keyof TaxRates;
    always?: boolean;
  }[] = [
    { key: "base", label: "Net before tax", amount: totals.base, always: true },
    { key: "nhil", label: "NHIL", amount: totals.nhil, rate: "nhilBps", always: true },
    { key: "getfund", label: "GETFund", amount: totals.getfund, rate: "getfundBps", always: true },
    { key: "vat", label: "VAT", amount: totals.vat, rate: "vatBps", always: true },
    { key: "covid", label: "COVID-19 levy", amount: totals.covid, rate: "covidBps" },
    { key: "round", label: "Rounding", amount: totals.roundingAdjustment },
  ];
  return (
    <section
      aria-label="Tax summary"
      className={`flex flex-col gap-6 rounded-lg border bg-card px-4 py-6 ${className ?? ""}`}
    >
      <div className="flex items-end justify-between">
        <div className="grid gap-1.5">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">
            Gross total, tax included
          </p>
          <p className="text-4xl leading-10 font-semibold tracking-tight tabular-nums">
            {formatGHS(totals.gross)}
          </p>
        </div>
        <div className="grid justify-items-end gap-1.5">
          <p className="text-xs text-muted-foreground">Items</p>
          <p className="text-xl font-bold tabular-nums">{items}</p>
        </div>
      </div>
      <dl className="flex flex-col text-base">
        {lines
          .filter((line) => line.always || line.amount !== 0)
          .map((line) => (
            <div className="flex h-12 items-center justify-between border-b" key={line.key}>
              <dt className="font-medium text-muted-foreground">
                {line.label}
                {rates && line.rate && ` ${formatBps(rates[line.rate])}`}
              </dt>
              <dd className="font-semibold tabular-nums">{formatGHS(line.amount)}</dd>
            </div>
          ))}
      </dl>
      <div
        className="mt-auto flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-3 text-sm"
        role="note"
      >
        <CreditCard aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <p>
          <span className="font-medium">Payments are available in the next checkout step.</span>{" "}
          <span className="text-muted-foreground">
            Until then the basket stays saved on this register.
          </span>
        </p>
      </div>
    </section>
  );
}
