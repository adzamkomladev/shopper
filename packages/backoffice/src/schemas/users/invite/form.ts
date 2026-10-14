import * as v from "valibot";

export const inviteFormSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Enter an email address"),
    v.email("Enter an email address like ama@example.com"),
  ),
  roleId: v.pipe(v.string(), v.nonEmpty("Choose a role")),
  channel: v.picklist(["email", "local"]),
});
