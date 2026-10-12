import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { CardContent } from "@shopper/ui/components/card";
import { FieldGroup } from "@shopper/ui/components/field";
import { ApiError } from "../../../api/client";
import { TextField } from "../../../components/fields/text";
import { loginSchema } from "../../../schemas/login";
import { useSignIn } from "./queries";

type Props = {
  box: { id: string; name: string } | null;
  defaultShopCode: string;
  onSignedIn: () => void;
};

export function LoginForm({ box, defaultShopCode, onSignedIn }: Props) {
  const signIn = useSignIn(box, onSignedIn);
  const form = useForm({
    defaultValues: { shopCode: defaultShopCode, email: "", password: "" },
    validators: { onSubmit: loginSchema(!box) },
    onSubmit: ({ value }) => signIn.mutate(value),
    onSubmitInvalid: ({ formApi }) => {
      const invalid = Object.entries(formApi.state.fieldMeta).find(
        ([, meta]) => meta.errors.length,
      );
      if (invalid) document.getElementById(invalid[0])?.focus();
    },
  });
  // The first empty field takes focus, so a prefilled shop code moves it on to the email.
  const focusFirst = !box && !defaultShopCode ? "shopCode" : "email";
  const error = signIn.error;
  const shopCodeError =
    error instanceof ApiError && error.field === "shopCode" ? error.message : undefined;
  return (
    <CardContent className="px-6 sm:px-22">
      <form
        noValidate
        className="flex flex-col gap-9"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <h1 className="sr-only">Log in to Shopper</h1>
        <div className="flex flex-col gap-2">
          <p aria-hidden className="text-4xl font-semibold tracking-tight text-primary">
            Shopper
          </p>
          {box && <p className="text-lg font-medium text-muted-foreground">{box.name}</p>}
        </div>
        <p className="text-lg font-medium">
          For security reasons please enter your email and password to continue using point of sale
        </p>
        <FieldGroup className="gap-9">
          {!box && (
            <form.Field name="shopCode">
              {(field) => (
                <TextField
                  field={field}
                  label="Shop code"
                  className="h-10"
                  serverError={shopCodeError}
                  autoFocus={focusFirst === "shopCode"}
                  autoComplete="organization"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              )}
            </form.Field>
          )}
          <form.Field name="email">
            {(field) => (
              <TextField
                field={field}
                label="Email"
                className="h-10"
                type="email"
                autoFocus={focusFirst === "email"}
                autoComplete="username"
              />
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <TextField
                field={field}
                label="Password"
                className="h-10"
                type="password"
                autoComplete="current-password"
              />
            )}
          </form.Field>
        </FieldGroup>
        {error && !shopCodeError && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="w-full rounded-full" disabled={signIn.isPending}>
          {signIn.isPending && <Loader2Icon className="animate-spin" />}
          {signIn.isPending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </CardContent>
  );
}
