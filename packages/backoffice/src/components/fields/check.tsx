import type { AnyFieldApi } from "@tanstack/react-form";
import { Checkbox } from "@shopper/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@shopper/ui/components/field";

type Props = {
  field: AnyFieldApi;
  label: string;
  description?: string;
  /** Called after the box changes, so a form can clear a server error. */
  onChange?: () => void;
};

/** A labelled checkbox bound to a boolean TanStack Form field, with its error beneath. */
export function CheckField({ field, label, description, onChange }: Props) {
  const message = field.state.meta.errors[0]?.message;
  const errorId = `${field.name}-error`;
  const descriptionId = `${field.name}-description`;
  const describedBy = [message && errorId, description && descriptionId].filter(Boolean).join(" ");
  return (
    <Field orientation="horizontal" data-invalid={!!message}>
      <Checkbox
        id={field.name}
        checked={field.state.value}
        aria-invalid={!!message}
        aria-describedby={describedBy || undefined}
        onCheckedChange={(checked) => {
          field.handleChange(checked === true);
          onChange?.();
        }}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
        {message && <FieldError id={errorId}>{message}</FieldError>}
      </FieldContent>
    </Field>
  );
}
