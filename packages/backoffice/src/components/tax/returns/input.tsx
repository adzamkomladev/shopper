import { useForm } from "@tanstack/react-form";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveInput } from "../../../queries/tax/returns";
import {
  inputFormSchema,
  inputValues,
  toInputBody,
  type VatReturnView,
} from "../../../schemas/tax/returns";
import { TextField } from "../../fields/text";
import { SaveBar } from "../../settings/page";

const FIELDS = [
  ["vat", "Input VAT"],
  ["nhil", "Input NHIL"],
  ["getfund", "Input GETFund levy"],
] as const;

/** The input tax the accountant claims for the month, from the purchase invoices they hold. */
export function InputForm({ worksheet }: { worksheet: VatReturnView }) {
  const online = useOnline();
  const save = useSaveInput(worksheet.period);
  const form = useForm({
    defaultValues: inputValues(worksheet.input),
    validators: { onSubmit: inputFormSchema },
    onSubmit: ({ value }) => save.mutate(toInputBody(value)),
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
      aria-labelledby="input-tax"
      className="flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2 id="input-tax" className="text-sm font-semibold">
        Input tax claimed
      </h2>
      <FieldGroup>
        {FIELDS.map(([name, label]) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <TextField
                field={field}
                label={label}
                description={name === "vat" ? "In cedis, from your purchase invoices." : undefined}
                inputMode="decimal"
                autoComplete="off"
                onChange={clearError}
              />
            )}
          </form.Field>
        ))}
      </FieldGroup>
      <SaveBar label="Save input tax" pending={save.isPending} error={save.error?.message} />
    </form>
  );
}
