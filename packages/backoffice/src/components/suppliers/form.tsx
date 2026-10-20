import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../admin/form/sheet";
import { TextField } from "../fields/text";
import { focusFirstInvalid } from "../../lib/focus";
import { useSaveSupplier, type SupplierView } from "../../queries/suppliers";
import { emptySupplier, supplierFormSchema, supplierValues } from "../../schemas/suppliers";

type Props = { supplier?: SupplierView; onSaved: () => void };

export function SupplierForm({ supplier, onSaved }: Props) {
  const online = useOnline();
  const save = useSaveSupplier(supplier, onSaved);
  const form = useForm({
    defaultValues: supplier ? supplierValues(supplier) : emptySupplier,
    validators: { onSubmit: supplierFormSchema },
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
        <form.Field name="phone">
          {(field) => (
            <TextField
              field={field}
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <TextField
              field={field}
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="tin">
          {(field) => (
            <TextField
              field={field}
              label="TIN"
              description="Tax identification number, if they have one."
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
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
      <FormFooter label="Save supplier" pending={save.isPending} online={online} />
    </form>
  );
}
