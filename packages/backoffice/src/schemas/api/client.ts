import * as v from "valibot";

export const problem = v.object({
  error: v.optional(v.string()),
  message: v.optional(v.string()),
  field: v.optional(v.string()),
  code: v.optional(v.string()),
});
