import { useState } from "react";
import { Button } from "@shopper/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@shopper/ui/components/radio-group";
import type { FulfilmentOptions } from "../../schemas/checkout";

const ACCRA = "Africa/Accra";
const time = new Intl.DateTimeFormat("en-GH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ACCRA,
});
const day = new Intl.DateTimeFormat("en-GH", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: ACCRA,
});
const dateKey = (iso: string) => iso.slice(0, 10);

/** "9:00 am – 10:00 am", in Accra time. */
export const slotLabel = (start: string, end: string) =>
  `${time.format(new Date(start))} – ${time.format(new Date(end))}`;

/** "Today", "Tomorrow" or the weekday and date. */
export function dayLabel(iso: string, now = new Date()) {
  const today = dateKey(now.toISOString());
  const tomorrow = dateKey(new Date(now.getTime() + 86_400_000).toISOString());
  if (dateKey(iso) === today) return "Today";
  if (dateKey(iso) === tomorrow) return "Tomorrow";
  return day.format(new Date(iso));
}

/**
 * The branch's open slots: a pill per day, then that day's start times as chips. A full slot is shown but cannot be
 * picked. The chosen slot stays chosen when the shopper looks at another day.
 */
export function SlotPicker({
  slots,
  value,
  onChange,
}: {
  slots: FulfilmentOptions["slots"];
  value: string;
  onChange: (start: string) => void;
}) {
  const days = [...new Set(slots.map((slot) => dateKey(slot.start)))];
  const [shown, setShown] = useState(value ? dateKey(value) : days[0]!);
  const daySlots = slots.filter((slot) => dateKey(slot.start) === shown);
  const minutes = Math.round(
    (new Date(slots[0]!.end).getTime() - new Date(slots[0]!.start).getTime()) / 60_000,
  );
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Day" className="flex flex-wrap gap-2">
        {days.map((key) => (
          <Button
            key={key}
            type="button"
            variant={key === shown ? "default" : "outline"}
            aria-pressed={key === shown}
            className="rounded-full"
            onClick={() => setShown(key)}
          >
            {dayLabel(`${key}T12:00:00.000Z`)}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {minutes >= 60 ? `${minutes / 60}-hour` : `${minutes}-minute`} slots, by when your order
        starts.
      </p>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        aria-label={`Time, ${dayLabel(`${shown}T12:00:00.000Z`)}`}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
      >
        {daySlots.map((slot) => {
          const id = `slot-${slot.start}`;
          const full = slot.remaining === 0;
          return (
            <label
              key={slot.start}
              htmlFor={id}
              title={slotLabel(slot.start, slot.end)}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border bg-card px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-shop-glow has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <RadioGroupItem
                id={id}
                value={slot.start}
                disabled={full}
                aria-label={`${slotLabel(slot.start, slot.end)}${full ? ", full" : ""}`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold whitespace-nowrap tabular-nums">
                  {time.format(new Date(slot.start))}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {full ? "Full" : slot.remaining <= 3 ? `${slot.remaining} left` : "Open"}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
