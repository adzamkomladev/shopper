import { useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { TextField } from "../../../components/fields/text";
import { focusFirstInvalid } from "../../../lib/focus";
import { SHOP_CODE_HELP, signupSchema, suggestShopCode } from "../../../schemas/onboarding";
import { AuthPanel } from "../frame";
import { useStartRegistration, type Started } from "./queries";

export function SignupForm({ onStarted }: { onStarted: (started: Started) => void }) {
  const start = useStartRegistration(onStarted);
  // The code follows the shop name until the person types their own.
  const codeEdited = useRef(false);
  const form = useForm({
    defaultValues: { name: "", email: "", shopName: "", shopCode: "" },
    validators: { onSubmit: signupSchema },
    onSubmit: ({ value }) => start.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  return (
    <AuthPanel
      title="Create your shop"
      description="Tell us who you are and what to call your shop. We'll email you a link to confirm it's you."
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
          <form.Field name="name">
            {(field) => <TextField field={field} label="Your name" autoFocus autoComplete="name" />}
          </form.Field>
          <form.Field name="email">
            {(field) => <TextField field={field} label="Email" type="email" autoComplete="email" />}
          </form.Field>
          <form.Field name="shopName">
            {(field) => (
              <TextField
                field={field}
                label="Shop name"
                autoComplete="organization"
                onChange={(event) => {
                  if (!codeEdited.current)
                    form.setFieldValue("shopCode", suggestShopCode(event.target.value));
                }}
              />
            )}
          </form.Field>
          <form.Field name="shopCode">
            {(field) => (
              <TextField
                field={field}
                label="Shop code"
                description={SHOP_CODE_HELP}
                autoCapitalize="none"
                spellCheck={false}
                onChange={() => {
                  codeEdited.current = true;
                }}
              />
            )}
          </form.Field>
        </FieldGroup>
        {start.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{start.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-4">
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full"
            disabled={start.isPending}
          >
            {start.isPending && <Loader2Icon className="animate-spin" />}
            {start.isPending ? "Sending the link…" : "Continue"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have a shop?{" "}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </form>
    </AuthPanel>
  );
}
