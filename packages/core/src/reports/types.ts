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

/** How an export column reads: text, money (1 GHS = 10000), a count, thousandths of a unit, or basis points. */
export type ReportCell =
  | { kind: "text"; value: string }
  | { kind: "money" | "count" | "quantity" | "bps"; value: number | null };

/** A report laid out for export: its file name, its column headers, then the rows (data rows, then any total). */
export interface ReportTable {
  name: string;
  headers: string[];
  rows: ReportCell[][];
}
