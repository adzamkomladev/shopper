import { CircleAlertIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import type { ShiftView } from "../../../schemas/shifts";

const FIELDS: Record<string, string> = {
  "sales.count": "number of sales",
  "sales.gross": "sales total",
  "sales.tax": "tax",
  "refunds.count": "number of refunds",
  "refunds.total": "refunds total",
  "account.sales": "sales on account",
  "account.refunds": "refunds to accounts",
  "account.points": "points redeemed",
  "account.pointsValue": "points value",
};
/** "cash.sales" → "cash sales"; the named totals read as words. */
const field = (name: string) => FIELDS[name] ?? name.replace(".", " ");

/** In the list, only what needs a look: a Z that disagrees with the server, or whose chain was changed. */
export function ChecksBadge({ checks }: { checks: ShiftView["checks"] }) {
  const problems = [
    ...(checks.totals.status === "mismatch" ? ["Totals differ"] : []),
    ...(checks.anchor === "mismatch" ? ["Chain changed"] : []),
  ];
  return problems.map((problem) => (
    <Badge key={problem} variant="destructive">
      <CircleAlertIcon aria-hidden />
      {problem}
    </Badge>
  ));
}

const ANCHOR = {
  verified: "Verified against the register's chain",
  pending: "Waiting for the register's chain",
  mismatch: "The register's chain no longer matches",
} as const;

/** On the shift: whether the Z agrees with the sales the server holds, and whether its audit anchor still holds. */
export function ShiftChecks({ checks }: { checks: ShiftView["checks"] }) {
  const totals = checks.totals;
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-muted-foreground">Totals against the server</dt>
        <dd
          className={totals.status === "mismatch" ? "font-medium text-destructive" : "font-medium"}
        >
          {totals.status === "matched"
            ? "Match the sales and refunds received"
            : `Differ in ${totals.fields.map(field).join(", ")}`}
        </dd>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs text-muted-foreground">Audit anchor</dt>
        <dd
          className={checks.anchor === "mismatch" ? "font-medium text-destructive" : "font-medium"}
        >
          {ANCHOR[checks.anchor]}
        </dd>
      </div>
    </dl>
  );
}
