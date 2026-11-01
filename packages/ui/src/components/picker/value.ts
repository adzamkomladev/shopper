// Picker values are the same ISO strings the native inputs produced, read in UTC (shop time).

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** A real calendar day as `YYYY-MM-DD`, or null. */
export function parseDay(text: string) {
  const match = DAY.exec(text.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return iso(date) === text.trim() ? text.trim() : null;
}

/** A 24-hour time as `HH:MM`, or null. */
export function parseTime(text: string) {
  return TIME.test(text.trim()) ? text.trim() : null;
}

export function parseMonth(text: string) {
  return MONTH.test(text.trim()) ? text.trim() : null;
}

/** `YYYY-MM-DD HH:MM` or `YYYY-MM-DDTHH:MM`, normalised to the `T` form `datetime-local` used. */
export function parseDateTime(text: string) {
  const [day = "", time = ""] = text.trim().split(/[T ]+/);
  const parsed = parseDay(day);
  const clock = parseTime(time);
  return parsed && clock ? `${parsed}T${clock}` : null;
}

export function today() {
  return iso(new Date());
}

export function addDays(day: string, days: number) {
  const date = toDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

/** The same day of another month, held to that month's last day. */
export function addMonths(day: string, months: number) {
  const date = toDate(day);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0));
  target.setUTCDate(Math.min(date.getUTCDate(), last.getUTCDate()));
  return iso(target);
}

/** Six Monday-first weeks covering the month of `day`. */
export function monthGrid(day: string) {
  const first = `${day.slice(0, 7)}-01`;
  const start = addDays(first, -((toDate(first).getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function inRange(day: string, min?: string, max?: string) {
  return (!min || day >= min.slice(0, 10)) && (!max || day <= max.slice(0, 10));
}

export function monthName(month: string, style: "long" | "short" = "long") {
  return toDate(`${month}-01`).toLocaleDateString("en-GB", { month: style, timeZone: "UTC" });
}

export function dayLabel(day: string) {
  return toDate(day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toDate(day: string) {
  return new Date(`${day.slice(0, 10)}T00:00:00Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}
