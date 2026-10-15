import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveMapping } from "../../../queries/catalogue/mappings";
import {
  emptyMapping,
  mappingFailure,
  mappingFormSchema,
  mappingValues,
  type MappingView,
} from "../../../schemas/catalogue/mappings";
import { FormFooter } from "../../admin/form/sheet";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { LayoutStrip } from "./strip";

const KINDS = [
  { value: "weight", label: "Weight" },
  { value: "price", label: "Price" },
];
const UNITS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
];

type Props = {
  mapping?: MappingView;
  /** Every layout, so a prefix that is already used is caught before it is sent. */
  layouts: MappingView[];
  onSaved: () => void;
};

export function MappingForm({ mapping, layouts, onSaved }: Props) {
  const online = useOnline();
  const save = useSaveMapping(mapping, onSaved);
  const taken = new Set(layouts.filter((other) => other.id !== mapping?.id).map((l) => l.prefix));
  const form = useForm({
    defaultValues: mapping ? mappingValues(mapping) : emptyMapping,
    validators: { onSubmit: mappingFormSchema },
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
  const failure = save.error && mappingFailure(save.error, form.getFieldValue("prefix"));
  const number = (
    name: "productStart" | "productLength" | "valueStart" | "valueLength",
    label: string,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <TextField
          field={field}
          label={label}
          inputMode="numeric"
          autoComplete="off"
          onChange={clearError}
        />
      )}
    </form.Field>
  );
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
        <form.Subscribe selector={(state) => state.values}>
          {(values) => <LayoutStrip layout={values} />}
        </form.Subscribe>
        <form.Field
          name="prefix"
          validators={{
            onSubmit: ({ value }) =>
              taken.has(Number(value))
                ? { message: `Prefix ${value.trim()} already has a layout. Edit that one instead.` }
                : undefined,
          }}
        >
          {(field) => (
            <TextField
              field={field}
              label="Prefix"
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              description="The two digits every label of this kind starts with, from 20 to 29."
              serverError={failure && "field" in failure ? failure.message : undefined}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="kind">
          {(field) => <SelectField field={field} label="Label type" options={KINDS} />}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.kind}>
          {(kind) =>
            kind === "weight" && (
              <form.Field name="unit">
                {(field) => <SelectField field={field} label="Weight unit" options={UNITS} />}
              </form.Field>
            )
          }
        </form.Subscribe>
        <div className="grid grid-cols-2 gap-4">
          {number("productStart", "Product code starts at digit")}
          {number("productLength", "Product code length (digits)")}
          {number("valueStart", "Value starts at digit")}
          {number("valueLength", "Value length (digits)")}
        </div>
        <form.Field name="decimals">
          {(field) => (
            <TextField
              field={field}
              label="Decimal places"
              inputMode="numeric"
              autoComplete="off"
              description="How many of the value's digits come after the decimal point. With 3, the digits 01250 mean 1.250."
              onChange={clearError}
            />
          )}
        </form.Field>
        {failure && !("field" in failure) && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{failure.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Save layout" pending={save.isPending} online={online} />
    </form>
  );
}
