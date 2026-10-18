import * as v from "valibot";

/** The same limits the host enforces on `session.signIn`, so a bad email never reaches the bridge. */
export const signInForm = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Enter your email address"),
    v.maxLength(320, "Use 320 characters or fewer"),
    v.email("Enter an email address like ama@shop.com"),
  ),
  password: v.pipe(
    v.string(),
    v.nonEmpty("Enter your password"),
    v.maxLength(256, "Use 256 characters or fewer"),
  ),
});

export type SignInErrors = Partial<Record<"email" | "password", string>>;

export function checkSignIn(email: string, password: string) {
  const result = v.safeParse(signInForm, { email, password });
  if (result.success) return { input: result.output, errors: {} satisfies SignInErrors };
  const errors: SignInErrors = {};
  for (const issue of result.issues) {
    const field = issue.path?.[0]?.key;
    if ((field === "email" || field === "password") && !errors[field])
      errors[field] = issue.message;
  }
  return { input: null, errors };
}
