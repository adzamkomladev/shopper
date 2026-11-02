import * as v from "valibot";
import { accountTypes, journalSources } from "@shopper/db-pg";
import { text } from "../fields";
import { day, reportQuery } from "../reports/query";

const id = v.pipe(v.string(), v.uuid(), v.toLowerCase());
const amount = v.pipe(
  v.number(),
  v.safeInteger(),
  v.check((value) => value !== 0, "A line needs an amount"),
);

/** A manual journal: its client id (posting it again is a no-op), its day and two or more signed lines (debit +). */
export const manualJournalInput = v.object({
  id,
  postedOn: day,
  memo: text(200),
  branchId: v.optional(id),
  lines: v.pipe(
    v.array(v.object({ accountId: id, amount, memo: v.optional(text(200)) })),
    v.minLength(2, "A journal entry needs two or more lines"),
    v.maxLength(100),
  ),
});
export type ManualJournalInput = v.InferOutput<typeof manualJournalInput>;

/** The day a reversal counts on; the original entry's day is kept on the original. */
export const reversalInput = v.object({ postedOn: day });

export const accountInput = v.object({
  code: v.pipe(v.string(), v.regex(/^[0-9]{4,6}$/, "A code is 4 to 6 digits")),
  name: text(120),
  type: v.picklist(accountTypes),
});
export type AccountInput = v.InferOutput<typeof accountInput>;

export const accountPatch = v.object({
  name: v.optional(text(120)),
  archived: v.optional(v.boolean()),
});
export type AccountPatch = v.InferOutput<typeof accountPatch>;

/** The last day the books are closed through; null opens them. */
export const lockInput = v.object({ through: v.nullable(day) });

export const asOfQuery = v.object({ asOf: day, branchId: v.optional(id) });
export const rangeQuery = reportQuery;
export const journalQuery = v.pipe(
  v.object({
    from: day,
    to: day,
    source: v.optional(v.picklist(journalSources)),
  }),
  v.check((q) => q.to >= q.from, "The range must end on or after its first day"),
);
