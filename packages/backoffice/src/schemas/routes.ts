import * as v from "valibot";

export const shopSearch = v.object({ shop: v.optional(v.string()) });

export const catalogueSearch = v.object({
  q: v.optional(v.string()),
  categoryId: v.optional(v.string()),
});

export const stockSearch = v.object({
  branch: v.optional(v.string()),
  q: v.optional(v.string()),
  low: v.optional(v.literal(true)),
});
export const stockProductSearch = v.object({ branch: v.optional(v.string()) });

/** What the records page filters to; "received" is the API's receipt kind, and so on (see lib/inventory/records). */
export const recordsSearch = v.object({
  branch: v.optional(v.string()),
  kind: v.optional(v.picklist(["received", "adjusted", "counted"])),
});

/** The count sheet's two views: only what is still uncounted, and the review that comes before posting. */
export const takeSheetSearch = v.object({
  uncounted: v.optional(v.literal(true)),
  review: v.optional(v.literal(true)),
});
