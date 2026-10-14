import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { TextField } from "../../../../fields/text";
import { focusFirstInvalid } from "../../../../../lib/focus";
import { existingJoinSchema, joinSchema } from "../../../../../schemas/auth/onboarding";
import { AuthPanel } from "../../../frame";
import type { LinkCredentials } from "../../../../../api/auth/public/api";
import {
  joinedButNotSignedIn,
  useJoin,
  type Preview,
} from "../../../../../queries/auth/accept/invitation";

type Props = { link: LinkCredentials; preview: Preview; onJoined: () => void };

export function JoinForm({ link, preview, onJoined }: Props) {
  const join = useJoin(link, preview, onJoined);
  const existing = preview.existingAccount;
  const form = useForm({
    defaultValues: { name: "", password: "" },
    validators: { onSubmit: existing ? existingJoinSchema : joinSchema },
    onSubmit: ({ value }) => join.mutate({ ...value }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const error = join.error;
  return (
    <AuthPanel
      title={`Join ${preview.shopName}`}
      description={
        existing ? (
          <>
            Sign in as <strong className="text-foreground">{preview.email}</strong> to join as{" "}
            <strong className="text-foreground">{preview.roleName}</strong>. Your password stays the
            same.
          </>
        ) : (
          <>
            You've been invited as <strong className="text-foreground">{preview.roleName}</strong>{" "}
            with <strong className="text-foreground">{preview.email}</strong>. Add your name and
            choose a password.
          </>
        )
      }
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
          {!existing && (
            <form.Field name="name">
              {(field) => (
                <TextField field={field} label="Your name" autoFocus autoComplete="name" />
              )}
            </form.Field>
          )}
          <form.Field name="password">
            {(field) => (
              <TextField
                field={field}
                label="Password"
                type="password"
                autoFocus={existing}
                autoComplete={existing ? "current-password" : "new-password"}
                description={existing ? undefined : "At least 12 characters."}
              />
            )}
          </form.Field>
        </FieldGroup>
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              {joinedButNotSignedIn(error)
                ? `You've joined, but we couldn't log you in: ${error.message}. `
                : `${error.message} `}
              {joinedButNotSignedIn(error) && (
                <Link to="/login" search={{ shop: preview.shopCode }} className="underline">
                  Log in
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="w-full rounded-full" disabled={join.isPending}>
          {join.isPending && <Loader2Icon className="animate-spin" />}
          {join.isPending ? "Joining…" : existing ? "Sign in and join" : "Create account and join"}
        </Button>
      </form>
    </AuthPanel>
  );
}
