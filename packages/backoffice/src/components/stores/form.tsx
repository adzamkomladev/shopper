import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../admin/form/sheet";
import { TextField } from "../fields/text";
import { focusFirstInvalid } from "../../lib/focus";
import { emptyStore, storeFormSchema, storeValues, type StoreView } from "../../schemas/management";
import { useSaveStore } from "../../queries/stores";

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
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="opensAt">
            {(field) => (
              <TextField field={field} label="Opens" type="time" step={60} onChange={clearError} />
            )}
          </form.Field>
          <form.Field name="closesAt">
            {(field) => (
              <TextField field={field} label="Closes" type="time" step={60} onChange={clearError} />
            )}
          </form.Field>
        </div>
        <p className="-mt-4 text-sm text-muted-foreground">
          Shop time. The day's Z-report reminder and summary go to owners at closing; a change
          applies from tomorrow.
        </p>
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
