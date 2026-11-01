import { CalendarIcon } from "lucide-react";
import { Calendar } from "#components/calendar";
import { PickerField } from "#components/picker/field";
import type { PickerProps } from "#components/picker/types";
import { parseDay } from "#components/picker/value";

type Props = PickerProps & { min?: string; max?: string };

/** A day, `YYYY-MM-DD` in shop time: typed, or picked from a calendar. */
export function DatePicker({ min, max, ...props }: Props) {
  return (
    <PickerField
      {...props}
      placeholder={props.placeholder ?? "YYYY-MM-DD"}
      // A day outside the allowed range is not a value, as with the native input's min and max.
      parse={(text) => {
        const day = parseDay(text);
        return day && (!min || day >= min) && (!max || day <= max) ? day : null;
      }}
      format={(value) => value}
      icon={<CalendarIcon aria-hidden />}
      openLabel="Choose a date"
      panel={(choose) => <Calendar value={props.value} min={min} max={max} onSelect={choose} />}
    />
  );
}
