import * as v from "valibot";

export const enrolFormSchema = v.object({
  branchId: v.pipe(v.string(), v.nonEmpty("Choose a branch")),
});
