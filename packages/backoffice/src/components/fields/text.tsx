import type { AnyFieldApi } from "@tanstack/react-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { focusOnMount } from "../../lib/focus";

type Props = Omit<React.ComponentProps<typeof Input>, "autoFocus"> & {
  field: AnyFieldApi;
  label: string;
  /** Help shown under the input, tied to it for screen readers. */
  description?: string;
  /** An error the server reported for this field. */
  serverError?: string;
  autoFocus?: boolean;
};

/** A labelled text input bound to a TanStack Form field, with its error wired to aria-describedby. */
export function TextField({ field, label, description, serverError, autoFocus, ...input }: Props) {
  const message = serverError ?? field.state.meta.errors[0]?.message;
  const errorId = `${field.name}-error`;
  const descriptionId = `${field.name}-description`;
  const describedBy = [message && errorId, description && descriptionId].filter(Boolean).join(" ");
  return (
    <Field data-invalid={!!message}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        {...input}
        id={field.name}
        name={field.name}
        value={field.state.value}
        // TanStack's handleBlur also revalidates, which clears a submit error. Moving focus to the
        // first invalid field blurs the others, so leaving a field only records it; editing clears.
        onBlur={() => field.setMeta((meta) => ({ ...meta, isTouched: true, isBlurred: true }))}
        onChange={(event) => {
          field.handleChange(event.target.value);
          input.onChange?.(event);
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
