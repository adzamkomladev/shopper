import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@shopper/ui/components/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { Switch } from "@shopper/ui/components/switch";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { SelectField } from "../../../components/fields/select";
import { TextField } from "../../../components/fields/text";
import { focusFirstInvalid } from "../../../lib/focus";
import { MOD_KEY } from "../../../lib/mod-key";
import { CategoryCombobox } from "../list/category-combobox";
import { TAX_CLASSES, UNITS } from "../list/options";
import {
  failureFor,
  DETAILS_FIELDS,
  detailsSchema,
  failureMessage,
  type DetailsValues,
} from "../../../schemas/product";
import { useSaveProduct, type ProductDetail } from "./queries";

const OFFLINE_NOTE_ID = "details-offline-note";

type Props = { product: ProductDetail; formRef: React.Ref<HTMLFormElement> };

export function DetailsForm({ product, formRef }: Props) {
  const online = useOnline();
  const save = useSaveProduct(product.id);
  const form = useForm({
    defaultValues: {
      name: product.name,
      sku: product.sku,
      baseUnit: product.baseUnit,
      taxClass: product.taxClass,
      categoryId: product.categoryId,
      onlineVisible: product.onlineVisible,
    } satisfies DetailsValues,
    validators: { onSubmit: detailsSchema },
    onSubmit: ({ value }) => {
      if (online) save.mutate(value, { onSuccess: () => form.reset(value) });
    },
    onSubmitInvalid: focusFirstInvalid,
  });
  // Editing after a failure clears it. A save still in flight must keep its pending state.
  const clearError = () => {
    if (save.isError) save.reset();
  };
  const failure = (name: string) => failureFor(save.error, name);
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card role="region" aria-labelledby="details-title">
        <CardHeader>
          <CardTitle id="details-title" role="heading" aria-level={2}>
            Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <TextField
                  field={field}
                  label="Name"
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
            <form.Field name="onlineVisible">
              {(field) => (
                <Field orientation="horizontal">
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>Visible online</FieldLabel>
                    <FieldDescription>
                      Customers can find this product in the online shop.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              )}
            </form.Field>
            {save.error && !failureFor(save.error, ...DETAILS_FIELDS) && (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertDescription>{failureMessage(save.error)}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap justify-end gap-x-4 gap-y-2">
          {!online && (
            <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
              You're offline. Reconnect to save your changes.
            </p>
          )}
          <Button
            type="submit"
            disabled={!online || save.isPending}
            aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
          >
            {save.isPending ? "Saving…" : "Save changes"}
            <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
