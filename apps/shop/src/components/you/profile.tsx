import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { toast } from "@shopper/ui/components/sonner";
import { Loader2 } from "lucide-react";
import { shopFetch } from "../../queries/api";
import { accountQuery } from "../../queries/account";
import { shopAccount, type ShopAccount } from "../../schemas/shop";

/** Name and email on the online account; the shop's own customer record is left as staff keep it. */
export function Profile({ shop, account }: { shop: string; account: ShopAccount }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(account.name ?? "");
  const [email, setEmail] = useState(account.email ?? "");
  const save = useMutation({
    mutationFn: () =>
      shopFetch("/account", shopAccount, { method: "PATCH", body: { name, email } }),
    onSuccess: (saved) => {
      queryClient.setQueryData(accountQuery(shop).queryKey, saved);
      toast.success("Saved");
    },
  });
  const changed = name !== (account.name ?? "") || email !== (account.email ?? "");
  return (
    <form
      className="space-y-4"
      aria-labelledby="profile-title"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h3 id="profile-title" className="font-bold">
        Your details
      </h3>
      <Field>
        <FieldLabel htmlFor="you-name">Name</FieldLabel>
        <Input
          id="you-name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 rounded-xl px-3 text-base"
        />
      </Field>
      <Field data-invalid={save.isError || undefined}>
        <FieldLabel htmlFor="you-email">Email</FieldLabel>
        <Input
          id="you-email"
          type="email"
          autoComplete="email"
          value={email}
          aria-invalid={save.isError || undefined}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 rounded-xl px-3 text-base"
        />
        <FieldError>{save.error?.message}</FieldError>
      </Field>
      <Button
        type="submit"
        className="h-11 rounded-xl px-5 font-semibold"
        disabled={!changed || save.isPending}
      >
        {save.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Save details
      </Button>
    </form>
  );
}
