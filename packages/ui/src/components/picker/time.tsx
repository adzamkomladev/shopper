import { cn } from "cn";
import { ClockIcon } from "lucide-react";
import { PickerField } from "#components/picker/field";
import type { PickerProps } from "#components/picker/types";
import { parseTime } from "#components/picker/value";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));

/** A 24-hour time, `HH:MM`: typed, or picked from an hour and a five-minute column. */
export function TimePicker(props: PickerProps) {
  return (
    <PickerField
      {...props}
      placeholder={props.placeholder ?? "HH:MM"}
      parse={parseTime}
      format={(value) => value}
      icon={<ClockIcon aria-hidden />}
      openLabel="Choose a time"
      panel={(choose) => (
        <TimeColumns value={props.value} onSelect={(time, done) => choose(time, !done)} />
      )}
    />
  );
}

/** Hours and minutes side by side. Picking an hour keeps the minutes, and the other way round. */
export function TimeColumns({
  value,
  onSelect,
}: {
  value: string;
  /** `done` is true once the minute is picked. */
  onSelect: (time: string, done: boolean) => void;
}) {
  const [hour = "", minute = ""] = value.split(":");
  return (
    <div data-slot="time-columns" className="flex gap-1">
      <Column
        label="Hour"
        options={HOURS}
        selected={hour}
        onPick={(next) => onSelect(`${next}:${minute || "00"}`, false)}
      />
      <Column
        label="Minute"
        options={MINUTES}
        // A minute between the steps marks the step below it.
        selected={minute && String(Math.floor(Number(minute) / 5) * 5).padStart(2, "0")}
        onPick={(next) => onSelect(`${hour || "00"}:${next}`, true)}
      />
    </div>
  );
}

function Column({
  label,
  options,
  selected,
  onPick,
}: {
  label: string;
  options: string[];
  selected: string;
  onPick: (option: string) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label={label}
      className="no-scrollbar flex h-64 w-14 flex-col gap-0.5 overflow-y-auto"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          aria-selected={option === selected}
          // The chosen entry scrolls to the middle when the panel opens.
          ref={option === selected ? centre : undefined}
          onClick={() => onPick(option)}
          className={cn(
            "flex h-8 shrink-0 items-center justify-center rounded-md text-sm tabular-nums transition-colors duration-150 outline-none hover:bg-accent",
            "aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary/90",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function centre(node: HTMLButtonElement | null) {
  node?.scrollIntoView({ block: "center" });
}
