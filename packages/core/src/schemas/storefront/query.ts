import * as v from "valibot";

const id = v.pipe(v.string(), v.uuid(), v.toLowerCase());

/** How many products one page of the store shows. */
export const STORE_PAGE_SIZE = 24;

/** A page of the store at one branch (default: the first), optionally one category or a search. */
export const storeProductsQuery = v.object({
  branch: v.optional(id),
  category: v.optional(id),
  q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(100))),
  page: v.optional(
    v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(1000)),
    "1",
  ),
});

/** A product or image id from the path; anything else is simply not in the store. */
export const storeId = v.pipe(v.string(), v.uuid());

export const storeProductQuery = v.object({ branch: v.optional(id) });
