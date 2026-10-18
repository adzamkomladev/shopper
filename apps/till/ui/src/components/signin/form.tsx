import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { checkSignIn, type SignInErrors } from "../../schemas/signin";

/**
 * Email and password, Enter submits. The Figma label reads "Username"; the host takes an email.
 * `onSubmit` resolves true when signed in; on a refusal the password clears and takes focus.
 */
export function SignInForm({
  signing,
  disabled,
  onSubmit,
}: {
  signing: boolean;
  disabled: boolean;
  onSubmit: (email: string, password: string) => Promise<boolean>;
}) {
  const [errors, setErrors] = useState<SignInErrors>({});
  const [password, setPassword] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signing || disabled) return;
    const { input, errors: found } = checkSignIn(emailRef.current?.value ?? "", password);
    setErrors(found);
    if (!input) return (found.email ? emailRef : passwordRef).current?.focus();
    if (await onSubmit(input.email, input.password)) return;
    setPassword("");
    passwordRef.current?.focus();
  }

  return (
    <form className="grid gap-8" noValidate onSubmit={(event) => void submit(event)}>
      <Field data-invalid={errors.email ? "true" : undefined}>
        <FieldLabel htmlFor="signin-email">Username</FieldLabel>
        <Input
          aria-describedby={errors.email ? "signin-email-error" : undefined}
          aria-invalid={errors.email ? true : undefined}
          autoComplete="username"
          autoFocus
          id="signin-email"
          inputMode="email"
          name="email"
          placeholder="Enter your email address"
          readOnly={signing}
          ref={emailRef}
          touch
          type="email"
        />
        {errors.email && <FieldError id="signin-email-error">{errors.email}</FieldError>}
      </Field>
      <Field data-invalid={errors.password ? "true" : undefined}>
        <FieldLabel htmlFor="signin-password">Password</FieldLabel>
        <Input
          aria-describedby={errors.password ? "signin-password-error" : undefined}
          aria-invalid={errors.password ? true : undefined}
          autoComplete="current-password"
          id="signin-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          readOnly={signing}
          ref={passwordRef}
          touch
          type="password"
          value={password}
        />
        {errors.password && <FieldError id="signin-password-error">{errors.password}</FieldError>}
      </Field>
      <Button
        aria-busy={signing}
        className="h-14 w-full rounded-xl text-base"
        disabled={signing || disabled}
        type="submit"
      >
        {signing && <LoaderCircle aria-hidden="true" className="animate-spin" />}
        {signing ? "Signing in…" : "Login"}
      </Button>
    </form>
  );
}
