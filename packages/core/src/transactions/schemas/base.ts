import * as v from "valibot";

const day = v.pipe(v.string(), v.isoDate());
const uuid = v.pipe(v.string(), v.uuid());

/** The explorer's filters: an Accra date range of at most a year, a search and narrowing filters, and a page. */
export const transactionQuery = v.pipe(
  v.object({
    from: day,
    to: day,
    q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(100)), ""),
    branchId: v.optional(uuid),
    cashierId: v.optional(uuid),
    tender: v.optional(v.picklist(["cash", "card", "momo", "credit", "loyalty"])),
    status: v.optional(v.picklist(["all", "completed", "refunded", "pending"]), "all"),
    /** The last row's time in milliseconds and its id. */
    cursor: v.optional(v.pipe(v.string(), v.regex(/^\d{1,15}\.[0-9a-f-]{36}$/i))),
    limit: v.optional(
      v.pipe(v.string(), v.transform(Number), v.safeInteger(), v.minValue(1), v.maxValue(100)),
      "25",
    ),
  }),
  v.check((q) => q.from <= q.to, "The range must end on or after its start"),
  v.check(
    (q) => Date.parse(q.to) - Date.parse(q.from) <= 366 * 86_400_000,
    "The range is at most a year",
  ),
);
