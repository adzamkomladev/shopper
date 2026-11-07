const day = new Intl.DateTimeFormat("en-GH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Africa/Accra",
});
const clock = new Intl.DateTimeFormat("en-GH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Accra",
});

/** "Today 2:00 pm – 3:00 pm", or the day when it is not today. */
export function slotLabel(start: string, end: string, now = new Date()) {
  const from = new Date(start);
  const same = day.format(from) === day.format(now);
  return `${same ? "Today" : day.format(from)} ${clock.format(from)} – ${clock.format(new Date(end))}`;
}

/** How far off the slot is: "in 40 min", "in 3 h", "15 min ago". */
export function untilSlot(start: string, now = new Date()) {
  const minutes = Math.round((new Date(start).getTime() - now.getTime()) / 60_000);
  const span = Math.abs(minutes);
  const text = span >= 120 ? `${Math.round(span / 60)} h` : `${span} min`;
  return minutes >= 0 ? `in ${text}` : `${text} ago`;
}

/** Thousandths as shoppers read them: 1.5 kg, 2. */
export function quantityText(thousandths: number, unit: string) {
  const value = thousandths / 1000;
  return unit === "each" ? String(value) : `${value} ${unit}`;
}
