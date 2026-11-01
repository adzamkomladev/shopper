import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { Loader2, MessageSquareText } from "lucide-react";
import { shopFetch } from "../../queries/api";
import { loginStarted } from "../../schemas/shop";
import { Turnstile } from "./turnstile";

/** Step one: the shopper's phone number. The code goes out by SMS and the next step asks for it. */
export function PhoneStep({
  shop,
  siteKey,
  initialPhone,
  onSent,
}: {
  shop: string;
  siteKey: string | null;
  initialPhone: string;
  onSent: (login: { loginId: string; phone: string }) => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [token, setToken] = useState("");
  const start = useMutation({
    mutationFn: () =>
      shopFetch(`/${shop}/signin`, loginStarted, { body: { phone, turnstile: token } }),
    onSuccess: (started) =>
      onSent({
        loginId: started.loginId,
        phone: phone.replace(/[\s()-]/g, "").replace(/^\+?233/, "0"),
      }),
  });
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        start.mutate();
      }}
    >
      <Field data-invalid={start.isError || undefined}>
        <FieldLabel htmlFor="phone" className="text-base font-semibold">
          Phone number
        </FieldLabel>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus
          placeholder="024 123 4567"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-invalid={start.isError || undefined}
          aria-describedby="phone-help"
          className="h-14 rounded-2xl px-4 text-xl font-semibold tracking-wide md:text-xl"
        />
        <FieldDescription id="phone-help">
          The number you give the cashier when you pay.
        </FieldDescription>
        <FieldError>{start.error?.message}</FieldError>
      </Field>
      {siteKey ? <Turnstile siteKey={siteKey} onToken={setToken} /> : null}
      <Button
        type="submit"
        size="touch"
        className="h-14 w-full rounded-2xl text-base font-bold"
        disabled={start.isPending || phone.trim().length < 9 || (siteKey !== null && !token)}
      >
        {start.isPending ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <MessageSquareText aria-hidden />
        )}
        {start.isPending ? "Sending your code" : "Text me a code"}
      </Button>
    </form>
  );
}
