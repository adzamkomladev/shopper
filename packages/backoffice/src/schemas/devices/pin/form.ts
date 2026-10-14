import * as v from "valibot";

export const pinFormSchema = v.object({
  userId: v.pipe(v.string(), v.nonEmpty("Choose a cashier")),
  pin: v.pipe(v.string(), v.regex(/^\d{4,8}$/, "Use 4 to 8 digits, like 4829")),
});
