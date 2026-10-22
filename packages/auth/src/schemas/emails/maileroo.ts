import * as v from "valibot";
export const mailAddress = v.pipe(v.string(), v.email());

export const mailResponse = v.object({
  success: v.literal(true),
  data: v.optional(v.object({ reference_id: v.optional(v.string()) })),
});
