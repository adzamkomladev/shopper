import { formatGHS, money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input/control";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { depositOf, owedOf, pointsLabel, pointsWorth } from "../../../sale/account/rules";
import type { AccountRead, AccountView } from "../../../sale/account/types";

const box = "flex min-h-14 min-w-0 flex-col justify-center rounded-md border px-2 py-1.5 sm:px-3";

/** What the attached customer may spend. The skeleton is the same three boxes, so nothing moves when it loads. */
export function AccountSummary({
  kind,
  read,
  onRetry,
}: {
  kind: "credit" | "loyalty";
  read: AccountRead | null;
  onRetry: () => void;
}) {
  if (read?.status === "failed")
    return (
      <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
        <p className="text-sm text-destructive">The account could not be read. {read.message}</p>
        <Button onClick={onRetry} size="touch" variant="outline">
          Try again
        </Button>
      </div>
    );
  if (read?.status !== "ready")
    return (
      <div aria-label="Loading account" className="grid shrink-0 grid-cols-3 gap-2" role="status">
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-14" key={index} />
        ))}
      </div>
    );
  const { account } = read;
  const rows = kind === "credit" ? creditRows(account) : pointsRows(account);
  return (
    <div aria-label="Account" className="shrink-0" role="group">
      <dl className="grid grid-cols-3 gap-2">
        {rows.map(([label, value]) => (
          <div className={box} key={label}>
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-xs font-semibold tabular-nums sm:text-sm" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const balanceRow = (account: AccountView) =>
  account.balance < 0
    ? (["Deposit", formatGHS(depositOf(account))] as const)
    : (["Owed", formatGHS(owedOf(account))] as const);

function creditRows(account: AccountView) {
  return [
    ["Limit", formatGHS(money(account.limit))],
    balanceRow(account),
    ["Available", formatGHS(money(Math.max(0, account.available)))],
  ] as const;
}

function pointsRows(account: AccountView) {
  return [
    ["Points", pointsLabel(account.points)],
    ["Worth", formatGHS(pointsWorth(account.points, account.pointValue))],
    balanceRow(account),
  ] as const;
}

/** The points to spend, and what they take off the sale. */
export function PointsEntry({
  value,
  points,
  account,
  onChange,
  onEnter,
}: {
  value: string;
  points: number | null;
  account: AccountView | null;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="grid shrink-0 gap-1.5">
      <label className="grid gap-1.5 text-sm font-medium">
        Points to use
        <Input
          aria-label="Points to use"
          className="h-11"
          inputMode="numeric"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onEnter();
          }}
          value={value}
        />
      </label>
      {account && points !== null && (
        <p className="text-sm text-muted-foreground tabular-nums" role="status">
          {pointsLabel(points)} = {formatGHS(pointsWorth(points, account.pointValue))}
        </p>
      )}
    </div>
  );
}

/** A refusal beside the amount it is about. */
export function AccountNotice({ problem }: { problem: string | null }) {
  if (!problem) return null;
  return (
    <p
      className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
      role="alert"
    >
      {problem}
    </p>
  );
}
