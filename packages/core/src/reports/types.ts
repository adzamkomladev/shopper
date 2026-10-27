/** Store days to fold from the raw rows: an Accra date per store. */
export type StoreDays = { storeId: string; day: string }[];

/** What a fold reads: an org's store days, optionally only some branches. */
export interface FoldFilter {
  orgId: string;
  days: StoreDays;
  branchIds?: string[];
}

/** A report's reach: an org's Accra date range, optionally only some branches (an empty list reaches none). */
export interface ReportRange {
  orgId: string;
  from: string;
  to: string;
  branchIds?: string[];
}
