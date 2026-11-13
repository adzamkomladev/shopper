import * as v from "valibot";
import { reportQuery } from "@shopper/core/reports";

export const entityNames = [
  "products",
  "prices",
  "customers",
  "sales",
  "lines",
  "tenders",
  "stock",
  "tax",
  "audit",
] as const;

/** Entities that are history rather than a list: they take a day range of at most a year. */
export const rangedEntities: readonly (typeof entityNames)[number][] = [
  "sales",
  "lines",
  "tenders",
  "audit",
];

/** Excel holds 1,048,576 rows; past this the sheet is slow to open anyway, so it points at CSV. */
export const MAX_WORKBOOK_ROWS = 200_000;

export const entityExport = v.object({
  entity: v.picklist(entityNames),
  format: v.picklist(["csv", "xlsx"]),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
  maxWorkbookRows: v.optional(v.number(), MAX_WORKBOOK_ROWS),
  /** Rows read per query; a test makes it small to cross pages. */
  pageRows: v.optional(v.number(), 5000),
});

/** The day range of a ranged export, checked like a report's: real days, in order, at most 366. */
export const entityRange = reportQuery;
