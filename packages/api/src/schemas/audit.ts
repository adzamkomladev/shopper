import * as v from "valibot";

/** `GET /audit/verify?stream=`: the org chain, or a register by id. */
export const auditStreamQuery = v.object({
  stream: v.union([v.literal("org"), v.pipe(v.string(), v.uuid(), v.toLowerCase())]),
});
