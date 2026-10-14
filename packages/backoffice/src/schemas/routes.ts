import * as v from "valibot";

export const shopSearch = v.object({ shop: v.optional(v.string()) });

export const catalogueSearch = v.object({
  q: v.optional(v.string()),
  categoryId: v.optional(v.string()),
});
