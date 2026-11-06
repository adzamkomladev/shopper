import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";

/** A labelled checkout input with its error tied to it. */
export function DetailField({
  id,
  label,
  value,
  onChange,
  error,
  description,
  ...input
}: Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  description?: string;
}) {
  const describedBy = [error && `${id}-error`, description && `${id}-help`]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id} className="font-semibold">
        {label}
      </FieldLabel>
      <Input
        {...input}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy || undefined}
        className="h-12 rounded-xl px-4 text-base md:text-base"
      />
      {description ? <FieldDescription id={`${id}-help`}>{description}</FieldDescription> : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}
