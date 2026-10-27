import * as v from "valibot";

/** The longest range one report reads: a year and a day, so any calendar year fits. */
export const MAX_REPORT_DAYS = 366;
const DAY_MS = 86_400_000;
// `isoDate` takes 2026-02-30; a real day reads back as itself. The check runs even when `isoDate` failed.
const day = v.pipe(
  v.string(),
  v.isoDate(),
  v.check((s) => new Date(`${s}T00:00:00.000Z`).toJSON()?.startsWith(s) === true, "No such day"),
);
const branchId = v.optional(v.pipe(v.string(), v.uuid(), v.toLowerCase()));

const range = { from: day, to: day, branchId };
type Range = { from: string; to: string };
const inOrder = <T extends Range>(q: T) => Date.parse(q.to) >= Date.parse(q.from);
const withinAYear = <T extends Range>(q: T) =>
  (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS < MAX_REPORT_DAYS;
const unordered = "The range must end on or after its first day";
const tooLong = `A report covers at most ${MAX_REPORT_DAYS} days`;

/** Accra dates from `from` to `to` (inclusive, at most a year), optionally one branch. */
export const reportQuery = v.pipe(
  v.object(range),
  v.check(inOrder, unordered),
  v.check(withinAYear, tooLong),
);
export type ReportQuery = v.InferOutput<typeof reportQuery>;

export const salesGroupings = ["day", "hour", "branch", "cashier", "tender"] as const;
export const salesQuery = v.pipe(
  v.object({ ...range, by: v.optional(v.picklist(salesGroupings), "day") }),
  v.check(inOrder, unordered),
  v.check(withinAYear, tooLong),
);
export type SalesQuery = v.InferOutput<typeof salesQuery>;

/** The day the dashboard shows (default: the shop's today), set against the day before it. */
export const dashboardQuery = v.object({ day: v.optional(day), branchId });

/** Products with stock that has not sold for 30, 60 or 90 days up to `on` (default: the shop's today). */
export const deadStockQuery = v.object({
  on: v.optional(day),
  days: v.optional(v.pipe(v.string(), v.transform(Number), v.picklist([30, 60, 90])), "30"),
  branchId,
});
