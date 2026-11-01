import * as React from "react";
import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "#components/button";
import {
  addDays,
  addMonths,
  dayLabel,
  inRange,
  monthGrid,
  monthName,
  today,
} from "#components/picker/value";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
// Arrow keys move a day or a week, Page keys a month; Home and End go to the week's ends.
const MOVES: Record<string, (day: string) => string> = {
  ArrowLeft: (day) => addDays(day, -1),
  ArrowRight: (day) => addDays(day, 1),
  ArrowUp: (day) => addDays(day, -7),
  ArrowDown: (day) => addDays(day, 7),
  PageUp: (day) => addMonths(day, -1),
  PageDown: (day) => addMonths(day, 1),
  Home: (day) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7)),
  End: (day) => addDays(day, 6 - ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7)),
};

type CalendarProps = {
  /** The chosen day, `YYYY-MM-DD`. */
  value?: string;
  onSelect: (day: string) => void;
  min?: string;
  max?: string;
  className?: string;
};

/** A month of days, Monday first, in shop time. Keyboard: arrows, Page Up/Down, Home/End, Enter. */
export function Calendar({ value, onSelect, min, max, className }: CalendarProps) {
  const now = today();
  // The focused day never leaves the allowed range, so the grid always has a day to tab to.
  const clamp = (day: string) =>
    min && day < min.slice(0, 10)
      ? min.slice(0, 10)
      : max && day > max.slice(0, 10)
        ? max.slice(0, 10)
        : day;
  const [focus, setFocus] = React.useState(clamp(value || now));
  // Keys move focus with the day; the month buttons only turn the page and keep their own focus.
  const [keyed, setKeyed] = React.useState(true);
  const turn = (months: number) => {
    setKeyed(false);
    setFocus(clamp(addMonths(focus, months)));
  };
  const month = focus.slice(0, 7);
  const weeks = monthGrid(focus);
  const move = (event: React.KeyboardEvent) => {
    const next = MOVES[event.key];
    if (!next) return;
    event.preventDefault();
    setKeyed(true);
    setFocus(clamp(next(focus)));
  };
  return (
    <div data-slot="calendar" className={cn("flex w-64 flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => turn(-1)}>
          <ChevronLeftIcon aria-hidden />
        </Button>
        <p aria-live="polite" className="text-sm font-medium">
          {monthName(month)} {month.slice(0, 4)}
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => turn(1)}>
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
      <table role="grid" aria-label={`${monthName(month)} ${month.slice(0, 4)}`} onKeyDown={move}>
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                className="h-8 text-xs font-normal text-muted-foreground"
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {weeks.slice(week * 7, week * 7 + 7).map((day) => (
                <td
                  key={day}
                  role="gridcell"
                  aria-selected={day === value}
                  className="p-0 text-center"
                >
                  <button
                    type="button"
                    // The focused day takes focus when it mounts or becomes the focused one.
                    ref={day === focus && keyed ? focusDay : undefined}
                    tabIndex={day === focus ? 0 : -1}
                    disabled={!inRange(day, min, max)}
                    data-selected={day === value || undefined}
                    aria-current={day === now ? "date" : undefined}
                    aria-label={dayLabel(day)}
                    onClick={() => onSelect(day)}
                    onFocus={() => setFocus(day)}
                    data-outside={day.slice(0, 7) !== month || undefined}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
                      "data-outside:not-data-selected:text-muted-foreground/60",
                      "aria-[current=date]:font-semibold aria-[current=date]:text-primary",
                      "data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:bg-primary/90",
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function focusDay(node: HTMLButtonElement | null) {
  node?.focus({ preventScroll: true });
}
