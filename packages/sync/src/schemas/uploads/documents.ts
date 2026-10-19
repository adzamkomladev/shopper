import * as v from "valibot";

/** The answer of a document upload (`/sync/stock`, `/sync/refunds`): applied, or refused for good. */
export const documentOutcome = v.object({
  accepted: v.optional(v.record(v.string(), v.unknown())),
  rejected: v.optional(v.object({ code: v.string(), message: v.string() })),
});
