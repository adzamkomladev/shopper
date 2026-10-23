import type { AnyFieldApi } from "@tanstack/react-form";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { focusOnMount } from "../../lib/focus";

type Props = {
  field: AnyFieldApi;
  label: string;
  options: readonly { value: string; label: string }[];
  /** Shown while nothing is chosen. */
  placeholder?: string;
  /** Focuses the select when it mounts. */
  autoFocus?: boolean;
  /** Called with the chosen value, after the field has taken it. */
  onChange?: (value: string) => void;
};

/** A labelled Select bound to a TanStack Form field; the label names the combobox. */
export function SelectField({ field, label, options, placeholder, autoFocus, onChange }: Props) {
  const message = field.state.meta.errors[0]?.message;
  const errorId = `${field.name}-error`;
  return (
    <Field data-invalid={!!message}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Select
        value={field.state.value}
        onValueChange={(value) => {
          field.handleChange(value);
          onChange?.(value);
        }}
      >
        <SelectTrigger
          id={field.name}
          ref={autoFocus ? focusOnMount : undefined}
          className="w-full"
          aria-invalid={!!message}
          aria-describedby={message ? errorId : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {message && <FieldError id={errorId}>{message}</FieldError>}
    </Field>
  );
}
