import type { Range } from "./types";

const MAX_DAYS = 366;
const DAY = 86_400_000;

/** From the first of this month to today, as the days (UTC, which is Ghana time all year) a statement covers. */
export function thisMonth(now = new Date()): Range {
  const today = now.toISOString().slice(0, 10);
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/** Whether the days make a period the API takes: both set, the start not after the end, at most a year. */
export function validRange({ from, to }: Range) {
  if (!from || !to) return false;
  const days = (Date.parse(to) - Date.parse(from)) / DAY;
  return days >= 0 && days < MAX_DAYS;
}
