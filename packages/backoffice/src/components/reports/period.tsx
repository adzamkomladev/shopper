import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Label } from "@shopper/ui/components/label";
import type { Period } from "../../lib/reports/types";
import { DatePicker } from "@shopper/ui/components/picker/date";

/** The period's date fields between previous and next buttons (`[` and `]`). */
export function PeriodControls({ period }: { period: Period }) {
  const step = (direction: -1 | 1, label: string, key: string) => (
    <Button
      variant="outline"
      size="icon"
      onClick={() => period.onStep(direction)}
      aria-label={label}
      aria-keyshortcuts={key}
      title={`${label} (${key})`}
    >
      {direction < 0 ? <ChevronLeftIcon aria-hidden /> : <ChevronRightIcon aria-hidden />}
    </Button>
  );
  const kind = period.kind;
  return (
    <div className="flex flex-wrap items-end gap-2 max-sm:w-full">
      {period.kind === "day" ? (
        <div className="flex flex-col gap-2 max-sm:flex-1">
          <Label htmlFor="report-day">Day</Label>
          <DatePicker
            id="report-day"
            value={period.day}
            onValueChange={(value) => value && period.onDay(value)}
            className="w-full sm:w-44"
          />
        </div>
      ) : (
        // On a phone the two dates share the row, and the steps go below them.
        <div className="grid grid-cols-2 gap-2 max-sm:w-full sm:flex">
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-from">From</Label>
            <DatePicker
              id="report-from"
              value={period.from}
              max={period.to}
              onValueChange={(value) => value && period.onRange({ from: value, to: period.to })}
              className="w-full sm:w-40"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-to">To</Label>
            <DatePicker
              id="report-to"
              value={period.to}
              min={period.from}
              onValueChange={(value) => value && period.onRange({ from: period.from, to: value })}
              className="w-full sm:w-40"
            />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        {step(-1, kind === "day" ? "Previous day" : "Previous period", "[")}
        {step(1, kind === "day" ? "Next day" : "Next period", "]")}
      </div>
      <span className="sr-only">
        Press <Kbd>[</Kbd> or <Kbd>]</Kbd> to step the period.
      </span>
    </div>
  );
}
