import type { AnyFieldApi } from "@tanstack/react-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Textarea } from "@shopper/ui/components/textarea";
import { focusOnMount } from "../../lib/focus";

type Props = Omit<React.ComponentProps<typeof Textarea>, "autoFocus"> & {
  field: AnyFieldApi;
  label: string;
  description?: string;
  autoFocus?: boolean;
};

/** A labelled multi-line input bound to a TanStack Form field, with its error wired to aria-describedby. */
export function AreaField({ field, label, description, autoFocus, ...input }: Props) {
  const message = field.state.meta.errors[0]?.message;
  const errorId = `${field.name}-error`;
  const descriptionId = `${field.name}-description`;
  const describedBy = [message && errorId, description && descriptionId].filter(Boolean).join(" ");
  return (
    <Field data-invalid={!!message}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Textarea
        {...input}
        id={field.name}
        name={field.name}
        value={field.state.value}
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
