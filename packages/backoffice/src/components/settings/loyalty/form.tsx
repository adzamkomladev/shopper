import { useForm } from "@tanstack/react-form";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveSettings } from "../../../queries/settings/resource";
import {
  loyaltyFormSchema,
  loyaltyValues,
  toLoyaltyBody,
  type LoyaltySettingsView,
} from "../../../schemas/settings/loyalty";
import { SwitchField } from "../../fields/switch";
import { TextField } from "../../fields/text";
import { SaveBar } from "../page";

/** The org's loyalty rules. The rate and the point's value are typed as decimals and stored as basis points and money. */
export function LoyaltyForm({ settings }: { settings: LoyaltySettingsView }) {
  const online = useOnline();
  const save = useSaveSettings("loyalty", "Loyalty settings saved");
  const form = useForm({
    defaultValues: loyaltyValues(settings),
    validators: { onSubmit: loyaltyFormSchema },
    onSubmit: ({ value }) => save.mutate(toLoyaltyBody(value)),
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
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="enabled">
          {(field) => (
            <SwitchField
              field={field}
              label="Loyalty points"
              description="When off, nobody earns or spends points."
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="earnRate">
          {(field) => (
            <TextField
              field={field}
              label="Earn rate (%)"
              description="The share of what a customer pays that comes back as points, before any tier rate."
              inputMode="decimal"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="pointValue">
          {(field) => (
            <TextField
              field={field}
              label="Value of one point (GH₵)"
              description="What a customer saves when they spend one point."
              inputMode="decimal"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="expiryDays">
          {(field) => (
            <TextField
              field={field}
              label="Points expire after (days)"
              description="0 means points never expire."
              inputMode="numeric"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="tierNoticeDays">
          {(field) => (
            <TextField
              field={field}
              label="Tier change notice (days)"
              description="How many days before a customer drops a tier they are told. 0 turns notices off."
              inputMode="numeric"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
      </FieldGroup>
      <SaveBar label="Save loyalty settings" pending={save.isPending} error={save.error?.message} />
    </form>
  );
}
