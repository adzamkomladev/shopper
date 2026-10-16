import * as v from "valibot";

export const receiptGrant = v.object({
  assetId: v.string(),
  url: v.optional(v.pipe(v.string(), v.url())),
  headers: v.optional(v.record(v.string(), v.string()), {}),
});
