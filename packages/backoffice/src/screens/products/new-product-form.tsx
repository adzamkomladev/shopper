import { useForm } from "@tanstack/react-form";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@shopper/ui/components/field";
import { SheetClose, SheetFooter } from "@shopper/ui/components/sheet";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { CircleAlertIcon } from "lucide-react";
import { SelectField } from "../../components/select-field";
import { TextField } from "../../components/text-field";
import { CategoryCombobox } from "./category-combobox";
import { emptyProduct, fieldOfError, messageOfError, newProductSchema } from "./product-form";
import { TAX_CLASSES, UNITS } from "./options";
import { useCreateProduct } from "./queries";

const OFFLINE_NOTE_ID = "save-offline-note";

export function NewProductForm({ onCreated }: { onCreated: () => void }) {
  const online = useOnline();
  const create = useCreateProduct(onCreated);
  const form = useForm({
    defaultValues: emptyProduct,
    validators: { onSubmit: newProductSchema },
    onSubmit: ({ value }) => create.mutate(value),
    onSubmitInvalid: ({ formApi }) => {
      const invalid = Object.entries(formApi.state.fieldMeta).find(
        ([, meta]) => meta.errors.length,
      );
      if (invalid) document.getElementById(invalid[0])?.focus();
    },
  });
  // Editing after a failure clears it. A save still in flight must keep its pending state.
  const clearError = () => {
    if (create.isError) create.reset();
  };
  const failedField = fieldOfError(create.error);
  const failure = (name: string) =>
    failedField === name && create.error ? messageOfError(create.error) : undefined;
  return (
    <form
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
              serverError={failure("name")}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="sku">
          {(field) => (
            <TextField
              field={field}
              label="SKU"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              serverError={failure("sku")}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="baseUnit">
          {(field) => <SelectField field={field} label="Unit" options={UNITS} />}
        </form.Field>
        <form.Field name="taxClass">
          {(field) => <SelectField field={field} label="Tax class" options={TAX_CLASSES} />}
        </form.Field>
        <form.Field name="categoryId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Category</FieldLabel>
              <CategoryCombobox
                id={field.name}
                value={field.state.value ?? null}
                onChange={field.handleChange}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="barcode">
          {(field) => (
            <TextField
              field={field}
              label="Barcode"
              description="Optional. Scan it or type the code."
              autoComplete="off"
              inputMode="numeric"
              serverError={failure("barcode")}
              onChange={clearError}
            />
          )}
        </form.Field>
        {create.error && !failedField && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{create.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      {!online && (
        <p id={OFFLINE_NOTE_ID} className="px-4 text-sm text-muted-foreground">
          You're offline. Reconnect to save this product.
        </p>
      )}
      <SheetFooter className="flex-col-reverse sm:flex-row sm:justify-end">
        <SheetClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </SheetClose>
        <Button
          type="submit"
          disabled={!online || create.isPending}
          aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
        >
          {create.isPending ? "Saving…" : "Save product"}
        </Button>
      </SheetFooter>
    </form>
  );
}
