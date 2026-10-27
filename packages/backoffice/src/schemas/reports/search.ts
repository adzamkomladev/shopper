import * as v from "valibot";

const day = v.optional(v.pipe(v.string(), v.isoDate()));
const branchId = v.optional(v.pipe(v.string(), v.uuid()));

/** What every report page keeps in its URL: a shop-date range (or one day) and optionally one branch. */
export const reportSearch = v.object({ from: day, to: day, day, branchId });
export type ReportSearch = v.InferOutput<typeof reportSearch>;

export const salesGroupings = ["day", "hour", "branch", "cashier", "tender"] as const;
export const salesSearch = v.object({
  ...reportSearch.entries,
  by: v.optional(v.picklist(salesGroupings)),
});
export const deadStockSearch = v.object({
  ...reportSearch.entries,
  // The router writes a numeric value to the URL as a number, so the window is kept as one.
  days: v.optional(v.picklist([30, 60, 90])),
});
