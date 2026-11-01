import * as React from "react";
import { cn } from "cn";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "#components/button";
import { PickerField } from "#components/picker/field";
import type { PickerProps } from "#components/picker/types";
import { monthName, parseMonth, today } from "#components/picker/value";

type Props = PickerProps & { min?: string; max?: string };

/** A month, `YYYY-MM`: typed, or picked from a year of months. */
export function MonthPicker({ min, max, ...props }: Props) {
  return (
    <PickerField
      {...props}
      placeholder={props.placeholder ?? "YYYY-MM"}
      parse={(text) => {
        const month = parseMonth(text);
        return month && (!min || month >= min) && (!max || month <= max) ? month : null;
      }}
      format={(value) => value}
      icon={<CalendarIcon aria-hidden />}
      openLabel="Choose a month"
      panel={(choose) => <Months value={props.value} min={min} max={max} onSelect={choose} />}
    />
  );
}

function Months({
  value,
  min,
  max,
  onSelect,
}: {
  value: string;
  min?: string;
  max?: string;
  onSelect: (month: string) => void;
}) {
  const [year, setYear] = React.useState(Number((value || today()).slice(0, 4)));
  const months = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  );
  return (
    <div className="flex w-64 flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous year"
          onClick={() => setYear(year - 1)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <p aria-live="polite" className="text-sm font-medium tabular-nums">
          {year}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next year"
          onClick={() => setYear(year + 1)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
      <div role="group" aria-label={String(year)} className="grid grid-cols-3 gap-1">
        {months.map((month) => (
          <button
            key={month}
            type="button"
            aria-pressed={month === value}
            aria-label={`${monthName(month)} ${year}`}
            disabled={(!!min && month < min) || (!!max && month > max)}
            ref={month === value ? focusMonth : undefined}
            onClick={() => onSelect(month)}
            className={cn(
              "flex h-9 items-center justify-center rounded-md text-sm transition-colors duration-150 outline-none hover:bg-accent disabled:pointer-events-none disabled:opacity-30",
              "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90",
            )}
          >
            {monthName(month, "short")}
          </button>
        ))}
      </div>
    </div>
  );
}

function focusMonth(node: HTMLButtonElement | null) {
  node?.focus({ preventScroll: true });
}
