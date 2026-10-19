import { formatGHS, money } from "@shopper/money";
import type { XReport } from "@shopper/core/schemas";
import { shiftClock } from "../../../lib/shifts/format";

type Names = Map<string, string | null>;

/** Cash drops and no-sales in the order they happened, each with who did it and why. */
export function Movements({ movements, names }: { movements: XReport["movements"]; names: Names }) {
  return (
    <ul className="divide-y">
      {movements.map((movement) => (
        <li
          className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
          key={`${movement.at}-${movement.kind}`}
        >
          <div className="min-w-0">
            <p className="font-medium">{movement.kind === "drop" ? "Cash drop" : "No sale"}</p>
            <p className="text-xs wrap-anywhere text-muted-foreground">
              {[shiftClock(movement.at), names.get(movement.actorId), movement.reason]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="shrink-0 tabular-nums">
            {movement.kind === "drop" ? formatGHS(money(movement.amount)) : "No cash"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Who sold on this shift, and the manager who approved a variance at close. */
export function Cashiers({
  cashiers,
  approver,
}: {
  cashiers: XReport["cashiers"];
  approver: string | null;
}) {
  return (
    <ul className="divide-y">
      {cashiers.map((cashier) => (
        <li className="px-4 py-3 text-sm" key={cashier.userId}>
          {cashier.name ?? "Unknown cashier"}
        </li>
      ))}
      {approver && (
        <li className="px-4 py-3 text-sm">
          Approved by <span className="font-medium">{approver}</span>
        </li>
      )}
    </ul>
  );
}
