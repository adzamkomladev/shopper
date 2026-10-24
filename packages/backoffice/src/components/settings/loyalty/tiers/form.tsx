import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../../lib/focus";
import { useSaveTier } from "../../../../queries/settings/tiers";
import {
  emptyTier,
  tierFormSchema,
  tierValues,
  type TierView,
} from "../../../../schemas/settings/loyalty";
import { FormFooter } from "../../../admin/form/sheet";
import { TextField } from "../../../fields/text";

type Props = { tier?: TierView; onSaved: () => void };

/** A tier's name, the spend that earns it and the rate it earns at. */
export function TierForm({ tier, onSaved }: Props) {
  const online = useOnline();
  const save = useSaveTier(tier, onSaved);
  const form = useForm({
    defaultValues: tier ? tierValues(tier) : emptyTier,
    validators: { onSubmit: tierFormSchema },
    onSubmit: ({ value }) => save.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  const clearError = () => {
    if (save.isError) save.reset();
  };
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        <form.Field name="name">
          {(field) => (
            <TextField
              field={field}
              label="Name"
              autoFocus
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="minSpend">
          {(field) => (
            <TextField
              field={field}
              label="Minimum spend (GH₵)"
              description="What a customer spends in the last 365 days to be in this tier."
              inputMode="decimal"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="rate">
          {(field) => (
            <TextField
              field={field}
              label="Earn rate (%)"
              description="Replaces the shop's rate for customers in this tier."
              inputMode="decimal"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        {save.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Save tier" pending={save.isPending} online={online} />
    </form>
  );
}
