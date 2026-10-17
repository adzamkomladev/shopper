import { cn } from "cn";
import { Field, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { useFocusRef } from "./focus";

/** A text field with its label above and its validation message below, wired for assistive technology. */
export function TextField({
  id,
  label,
  value,
  error,
  readOnly,
  inputMode,
  className,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  readOnly: boolean;
  inputMode?: "numeric";
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className={cn("gap-2", className)} data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        id={id}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        ref={useFocusRef(id)}
        touch
        value={value}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
