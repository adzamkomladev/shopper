import * as v from "valibot";

/** `POST /sync/stock` answer: the document applied, or refused for good. */
export const stockOutcome = v.object({
  accepted: v.optional(v.record(v.string(), v.unknown())),
  rejected: v.optional(v.object({ code: v.string(), message: v.string() })),
});
