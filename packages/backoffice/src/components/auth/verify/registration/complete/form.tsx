import { useForm } from "@tanstack/react-form";
import { Link as RouterLink } from "@tanstack/react-router";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { ApiError } from "../../../../../api/client";
import { TextField } from "../../../../fields/text";
import { focusFirstInvalid } from "../../../../../lib/focus";
import { completeSchema, SHOP_CODE_HELP } from "../../../../../schemas/auth/onboarding";
import { AuthPanel } from "../../../frame";
import { useSignIn } from "../../../../../queries/auth/login";
import type { LinkCredentials as Link } from "../../../../../api/auth/public/api";
import { useComplete } from "../../../../../queries/auth/verify/registration";

type Props = { link: Link; email: string; shopCode: string; onSignedIn: () => void };

// A taken code (409) belongs to the Shop code field; a rejected value names its own field.
function errorField(error: Error | null) {
  if (!(error instanceof ApiError)) return undefined;
  return error.status === 409 ? "shopCode" : error.field;
}

/** The password is asked only now, after the email is verified, and goes straight to the server. */
export function CompleteForm({ link, email, shopCode, onSignedIn }: Props) {
  const signIn = useSignIn(null, onSignedIn);
  const complete = useComplete(link, (done) => signIn.mutate(done));
  const form = useForm({
    defaultValues: { shopCode, password: "" },
    validators: { onSubmit: completeSchema },
    onSubmit: ({ value }) =>
      complete.mutate(
        { ...value },
        {
          onError: (error) => {
            const field = errorField(error);
            if (field) document.getElementById(field)?.focus();
          },
        },
      ),
    onSubmitInvalid: focusFirstInvalid,
  });
  const failure = complete.error;
  const field = errorField(failure);
  const created = complete.isSuccess;
  return (
    <AuthPanel
      title="Set up your shop"
      description={`${email} is verified. Choose your shop code and a password to finish.`}
    >
      <form
        noValidate
        className="flex flex-col gap-9"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup className="gap-6">
          <form.Field name="password">
            {(passwordField) => (
              <TextField
                field={passwordField}
                label="Password"
                type="password"
                autoFocus
                autoComplete="new-password"
                description="At least 12 characters."
                serverError={field === "password" ? failure?.message : undefined}
              />
            )}
          </form.Field>
          <form.Field name="shopCode">
            {(codeField) => (
              <TextField
                field={codeField}
                label="Shop code"
                description={SHOP_CODE_HELP}
                autoCapitalize="none"
                spellCheck={false}
                serverError={field === "shopCode" ? failure?.message : undefined}
              />
            )}
          </form.Field>
        </FieldGroup>
        {failure && !field && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{failure.message}</AlertDescription>
          </Alert>
        )}
        {created && signIn.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              Your shop is ready, but we couldn't log you in: {signIn.error.message}{" "}
              <RouterLink
                to="/login"
                search={{ shop: complete.data.shopCode }}
                className="underline"
              >
                Log in
              </RouterLink>
            </AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full"
          disabled={complete.isPending || signIn.isPending}
        >
          {(complete.isPending || signIn.isPending) && <Loader2Icon className="animate-spin" />}
          {complete.isPending
            ? "Creating your shop…"
            : signIn.isPending
              ? "Logging in…"
              : "Create shop"}
        </Button>
      </form>
    </AuthPanel>
  );
}
