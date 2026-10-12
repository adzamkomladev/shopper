import type { AnyFieldApi } from "@tanstack/react-form";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";

type Props = {
  field: AnyFieldApi;
  label: string;
  options: readonly { value: string; label: string }[];
};

/** A labelled Select bound to a TanStack Form field; the label names the combobox. */
export function SelectField({ field, label, options }: Props) {
  return (
    <Field>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Select value={field.state.value} onValueChange={field.handleChange}>
        <SelectTrigger id={field.name} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
