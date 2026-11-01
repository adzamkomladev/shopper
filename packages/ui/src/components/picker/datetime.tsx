import { CalendarClockIcon } from "lucide-react";
import { Calendar } from "#components/calendar";
import { PickerField } from "#components/picker/field";
import type { PickerProps } from "#components/picker/types";
import { TimeColumns } from "#components/picker/time";
import { parseDateTime, today } from "#components/picker/value";

type Props = PickerProps & { min?: string; max?: string };

/**
 * A day and a time, `YYYY-MM-DDTHH:MM` as `datetime-local` gave. Shown and typed as
 * `2026-11-01 08:30`; the panel keeps the time when a day is picked and the other way round.
 */
export function DateTimePicker({ min, max, ...props }: Props) {
  const [day = "", time = ""] = props.value.split("T");
  // A picked day keeps the time, held inside the range as a typed value would be.
  const within = (value: string) => (min && value < min ? min : max && value > max ? max : value);
  return (
    <PickerField
      {...props}
      placeholder={props.placeholder ?? "YYYY-MM-DD HH:MM"}
      parse={(text) => {
        const value = parseDateTime(text);
        return value && (!min || value >= min) && (!max || value <= max) ? value : null;
      }}
      format={(value) => value.replace("T", " ")}
      icon={<CalendarClockIcon aria-hidden />}
      openLabel="Choose a date and time"
      panel={(choose) => (
        <div className="flex gap-3">
          <Calendar
            value={day}
            min={min}
            max={max}
            onSelect={(next) => choose(within(`${next}T${time || "00:00"}`), true)}
          />
          <div className="border-l pl-3">
            <TimeColumns
              value={time}
              onSelect={(next, done) => choose(within(`${day || today()}T${next}`), !done)}
            />
          </div>
        </div>
      )}
    />
  );
}
