import { DENOMINATIONS } from "@shopper/core/schemas";
import { formatGHS, money } from "@shopper/money";
import { denominationKind, denominationLabel } from "@shopper/backoffice/shifts";
import { Input } from "@shopper/ui/components/input/control";
import { countedTotal } from "../../../shift/amount";
import type { CountText } from "../../../shift/types";

/** One count box per face, two to a row so the whole drawer fits a phone in four screens' worth less scrolling. */
export function CountGrid({
  values,
  onChange,
}: {
  values: CountText;
  onChange: (face: string, text: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DENOMINATIONS.map((face, index) => (
        <label
          className="flex min-w-0 flex-col gap-1.5 rounded-md border bg-card px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:py-1.5"
          key={face}
        >
          <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 sm:block">
            <span className="block text-sm font-medium">{denominationLabel(face)}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {denominationKind(face)}
            </span>
          </span>
          <Input
            aria-label={`Count of ${denominationLabel(face)}`}
            autoComplete="off"
            autoFocus={index === 0}
            className="text-right tabular-nums sm:w-24"
            inputMode="numeric"
            onChange={(event) =>
              onChange(String(face), event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            touch
            value={values[String(face)] ?? ""}
          />
        </label>
      ))}
    </div>
  );
}

/** What was counted so far, never what the register expects. */
export function CountTotal({ values }: { values: CountText }) {
  return (
    <p
      className="flex items-baseline justify-between gap-4 rounded-md bg-muted px-4 py-2 text-lg font-bold tabular-nums"
      role="status"
    >
      <span>Counted</span> <span>{formatGHS(money(countedTotal(values)))}</span>
    </p>
  );
}
