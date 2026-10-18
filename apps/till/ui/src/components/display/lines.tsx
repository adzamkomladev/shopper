import { cn } from "cn";
import { formatGHS, money } from "@shopper/money";
import { formatQuantity } from "../../sale/quantity";
import type { PricedRow } from "../../sale/types";

/**
 * The customer's basket. The newest line is highlighted. The list packs to the bottom, so a long basket
 * clips its oldest lines and never the newest; `mb-auto` on the newest line keeps a short basket at the top.
 */
export function DisplayLines({ rows, storeName }: { rows: PricedRow[]; storeName: string | null }) {
  return (
    <section
      aria-label="Basket"
      className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-3xl border bg-card p-10"
    >
      <header className="flex items-center justify-between gap-6 pb-3 leading-none">
        <h1 className="text-5xl font-semibold tracking-tight">Your basket</h1>
        {storeName ? (
          <p className="truncate text-2xl font-medium tracking-tight text-muted-foreground">
            {storeName}
          </p>
        ) : null}
      </header>
      <ul
        aria-label="Basket lines"
        className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden"
      >
        {rows.map((row, index) => {
          const latest = index === rows.length - 1;
          return (
            <li
              key={row.lineId}
              aria-current={latest ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-6 rounded-panel py-4.5 pr-6 pl-5 leading-none",
                latest && "mb-auto border-2 border-primary bg-secondary",
              )}
            >
              <span className="flex h-14 min-w-20 shrink-0 items-center justify-center rounded-xl bg-muted text-3xl font-semibold tracking-tight">
                {formatQuantity(row.line.quantityThousandths)}×
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-4xl tracking-tight",
                  latest ? "font-bold" : "font-semibold",
                )}
              >
                {row.name}
              </span>
              <span className="shrink-0 text-4xl font-bold tracking-tight tabular-nums">
                {formatGHS(money(row.tax.gross))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
