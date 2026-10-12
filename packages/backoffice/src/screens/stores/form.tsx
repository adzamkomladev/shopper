import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../components/admin/form-sheet";
import { TextField } from "../../components/fields/text";
import { focusFirstInvalid } from "../../lib/focus";
import { emptyStore, storeFormSchema, storeValues, type StoreView } from "../../schemas/management";
import { useSaveStore } from "./queries";

type Props = { store?: StoreView; onSaved: () => void };

export function StoreForm({ store, onSaved }: Props) {
  const online = useOnline();
  const save = useSaveStore(store, onSaved);
  const form = useForm({
    defaultValues: store ? storeValues(store) : emptyStore,
    validators: { onSubmit: storeFormSchema },
    onSubmit: ({ value }) => save.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  // Editing after a failure clears it. A save still in flight must keep its pending state.
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
        <form.Field name="cashRounding">
          {(field) => (
            <TextField
              field={field}
              label="Cash rounding (GH₵)"
              description="The smallest amount a cash total is rounded to, like 0.05."
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
      <FormFooter label="Save store" pending={save.isPending} online={online} />
    </form>
  );
}
