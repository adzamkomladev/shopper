import { shopToday } from "../tax/dates";
import type { Period } from "./types";

const DAY_MS = 86_400_000;
const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The longest range the reports API answers, in days. */
export const MAX_DAYS = 366;

/**
 * The range a report page shows: its URL's, else this month so far. A start after the end, or more than a year
 * before it, is pulled back in, so a hand-edited URL or date field still asks for a range the API answers.
 */
export function rangeOf(search: { from?: string; to?: string }, today = shopToday()) {
  const to = search.to ?? today;
  const from = search.from ?? `${today.slice(0, 7)}-01`;
  const earliest = shift(to, 1 - MAX_DAYS);
  return { from: from > to ? to : from < earliest ? earliest : from, to };
}

/** The same length of range just before (`-1`) or after (`1`) this one: what `[` and `]` step to. */
export function stepRange(range: { from: string; to: string }, direction: -1 | 1) {
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1;
  return { from: shift(range.from, direction * days), to: shift(range.to, direction * days) };
}

/** The day before or after. */
export const stepDay = (day: string, direction: -1 | 1) => shift(day, direction);

/** "Change vs yesterday" as a signed percentage, or nothing to compare with. */
export const percent = (bps: number | null) =>
  bps === null ? null : `${bps > 0 ? "+" : ""}${(bps / 100).toFixed(2)}%`;

/** A range period whose changes and steps go to `go`. */
export const rangePeriod = (
  range: { from: string; to: string },
  go: (range: { from: string; to: string }) => void,
): Period => ({
  kind: "range",
  ...range,
  // Moving one end past the other, or more than a year from it, brings the other along.
  onRange: (next) =>
    go(
      next.from !== range.from
        ? { from: next.from, to: rangeEnd(next.from, next.to) }
        : rangeOf(next),
    ),
  onStep: (direction) => go(stepRange(range, direction)),
});

const rangeEnd = (from: string, to: string) => {
  const latest = shift(from, MAX_DAYS - 1);
  return to < from ? from : to > latest ? latest : to;
};
