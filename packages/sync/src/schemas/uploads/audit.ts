import * as v from "valibot";

/** The answer of `POST /sync/audit`: the server's head of this till's chain, or a refusal for good. */
export const auditOutcome = v.object({
  accepted: v.optional(
    v.object({ head: v.object({ seq: v.pipe(v.number(), v.safeInteger()), hash: v.string() }) }),
  ),
  rejected: v.optional(v.object({ code: v.string(), message: v.string() })),
});
