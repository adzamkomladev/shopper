import type { AnyFieldApi } from "@tanstack/react-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { DatePicker } from "@shopper/ui/components/picker/date";
import { DateTimePicker } from "@shopper/ui/components/picker/datetime";
import { TimePicker } from "@shopper/ui/components/picker/time";
import { focusOnMount } from "../../lib/focus";

const PICKERS = { date: DatePicker, time: TimePicker, datetime: DateTimePicker };

type Props = {
  field: AnyFieldApi;
  label: string;
  kind?: keyof typeof PICKERS;
  /** Help shown under the field, tied to it for screen readers. */
  description?: string;
  /** An error the server reported for this field. */
  serverError?: string;
  autoFocus?: boolean;
  /** Runs after each change, e.g. to clear a form error. */
  onChange?: () => void;
};

/** A labelled date, time or date-and-time picker bound to a TanStack Form field, like TextField. */
export function DateField({
  field,
  label,
  kind = "date",
  description,
  serverError,
  autoFocus,
  onChange,
}: Props) {
  const Picker = PICKERS[kind];
  const message = serverError ?? field.state.meta.errors[0]?.message;
  const errorId = `${field.name}-error`;
  const descriptionId = `${field.name}-description`;
  const describedBy = [message && errorId, description && descriptionId].filter(Boolean).join(" ");
  return (
    <Field data-invalid={!!message}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Picker
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={() => field.setMeta((meta) => ({ ...meta, isTouched: true, isBlurred: true }))}
        onValueChange={(value) => {
          field.handleChange(value);
          onChange?.();
        }}
        ref={autoFocus ? focusOnMount : undefined}
        aria-invalid={!!message}
        aria-describedby={describedBy || undefined}
      />
      {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      {message && <FieldError id={errorId}>{message}</FieldError>}
    </Field>
  );
}
