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
