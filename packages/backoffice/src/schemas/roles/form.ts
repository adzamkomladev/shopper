import * as v from "valibot";

export const roleFormSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Enter a role name"),
    v.maxLength(100, "Keep the name to 100 characters or fewer"),
  ),
  permissionCodes: v.array(v.string()),
});
