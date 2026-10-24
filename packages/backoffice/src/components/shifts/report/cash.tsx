import { formatGHS, money, mulRatio } from "@shopper/money";
import type { XReport, ZReport } from "@shopper/core/schemas";
import { DENOMINATIONS } from "@shopper/core/schemas";
import { denominationLabel, deduction } from "../../../lib/shifts/format";

const cedis = (amount: number) => formatGHS(money(amount));

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? "border-t pt-3 text-base font-bold" : ""}`}
    >
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-lg" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

/** The drawer's arithmetic: float plus cash kept and cash paid onto accounts, less refunds and drops. */
export function CashBox({ cash, accountCash }: { cash: XReport["cash"]; accountCash: number }) {
  return (
    <dl className="grid gap-2 p-4 text-sm">
      <Row label="Float" value={cedis(cash.float)} />
      <Row label="Cash sales" value={cedis(cash.sales)} />
      <Row label="Cash refunds" value={deduction(cash.refunds)} />
      <Row label="Cash on accounts" value={cedis(accountCash)} />
      <Row label="Drops" value={deduction(cash.drops)} />
      <Row label="Expected in drawer" strong value={cedis(cash.expected)} />
    </dl>
  );
}

/** The notes and coins the cashier counted at close, from the largest face down. */
export function CountedCash({ declared }: { declared: ZReport["declared"] }) {
  const rows = DENOMINATIONS.map((face) => ({
    face,
    count: declared.counts[String(face)] ?? 0,
  })).filter((row) => row.count > 0);
  return (
    <div className="grid gap-2 p-4 text-sm">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No notes or coins counted</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map(({ face, count }) => (
            <li className="flex justify-between gap-4" key={face}>
              <span>
                {count} × {denominationLabel(face)}
              </span>
              <span className="font-medium tabular-nums">
                {cedis(mulRatio(money(face), count, 1))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <dl className="grid">
        <Row label="Counted" strong value={cedis(declared.cash)} />
      </dl>
    </div>
  );
}
