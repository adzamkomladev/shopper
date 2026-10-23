import { useForm } from "@tanstack/react-form";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveSettings } from "../../../queries/settings/resource";
import {
  creditFormSchema,
  creditValues,
  toCreditBody,
  type CreditSettingsView,
} from "../../../schemas/settings/credit";
import { TextField } from "../../fields/text";
import { SaveBar } from "../page";

/** How long customers have to pay and what an overdue balance costs. The rate is typed as a percentage. */
export function CreditForm({ settings }: { settings: CreditSettingsView }) {
  const online = useOnline();
  const save = useSaveSettings("credit", "Credit settings saved");
  const form = useForm({
    defaultValues: creditValues(settings),
    validators: { onSubmit: creditFormSchema },
    onSubmit: ({ value }) => save.mutate(toCreditBody(value)),
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
        <form.Field name="termsDays">
          {(field) => (
            <TextField
              field={field}
              label="Payment terms (days)"
              description="How long a customer has to pay a charge before it is overdue."
              inputMode="numeric"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="interest">
          {(field) => (
            <TextField
              field={field}
              label="Monthly interest (%)"
              description="Charged each month on what is overdue. 0 turns interest off."
              inputMode="decimal"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
      </FieldGroup>
      <SaveBar label="Save credit settings" pending={save.isPending} error={save.error?.message} />
    </form>
  );
}
