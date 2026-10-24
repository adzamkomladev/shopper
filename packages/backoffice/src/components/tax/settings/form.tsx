import { useForm, useStore } from "@tanstack/react-form";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveSettings } from "../../../queries/settings/resource";
import {
  taxFormSchema,
  taxValues,
  toTaxBody,
  type TaxSettingsView,
} from "../../../schemas/tax/settings";
import { SelectField } from "../../fields/select";
import { SwitchField } from "../../fields/switch";
import { TextField } from "../../fields/text";
import { SaveBar } from "../../settings/page";

const PRICE_MODES = [
  { value: "inclusive", label: "Shelf prices include VAT and levies" },
  { value: "exclusive", label: "VAT and levies are added to shelf prices" },
] as const;
const ROUNDING = [
  { value: "10p", label: "Round cash to the nearest 10 pesewas" },
  { value: "none", label: "Do not round cash" },
] as const;

/** The business's TIN and VAT registration, how shelf prices treat tax, and how cash is rounded. */
export function TaxSettingsForm({ settings }: { settings: TaxSettingsView }) {
  const online = useOnline();
  const save = useSaveSettings("tax", "Tax settings saved");
  const form = useForm({
    defaultValues: taxValues(settings),
    validators: { onSubmit: taxFormSchema },
    onSubmit: ({ value }) => save.mutate(toTaxBody(value)),
    onSubmitInvalid: focusFirstInvalid,
  });
  const registered = useStore(form.store, (state) => state.values.registered);
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
        <form.Field name="registered">
          {(field) => (
            <SwitchField
              field={field}
              label="VAT-registered"
              description="Sales then charge VAT, NHIL and GETFund, and receipts are VAT invoices. Off, sales charge no tax and print a plain receipt."
              onChange={clearError}
            />
          )}
        </form.Field>
        {registered && (
          <>
            <form.Field name="tin">
              {(field) => (
                <TextField
                  field={field}
                  label="Business TIN"
                  description="Printed on every VAT invoice and credit note."
                  autoComplete="off"
                  onChange={clearError}
                />
              )}
            </form.Field>
            <form.Field name="vatRegisteredFrom">
              {(field) => (
                <TextField
                  field={field}
                  type="date"
                  label="Registered from"
                  description="Sales from this date on carry VAT. Sales already made keep the tax they were rung up with."
                  onChange={clearError}
                />
              )}
            </form.Field>
          </>
        )}
        <form.Field name="priceMode">
          {(field) => (
            <SelectField
              field={field}
              label="Shelf prices"
              options={PRICE_MODES}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="cashRounding">
          {(field) => (
            <SelectField
              field={field}
              label="Cash rounding"
              options={ROUNDING}
              onChange={clearError}
            />
          )}
        </form.Field>
      </FieldGroup>
      <SaveBar label="Save tax settings" pending={save.isPending} error={save.error?.message} />
    </form>
  );
}
