import type { AnyFieldApi } from "@tanstack/react-form";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@shopper/ui/components/field";
import { Switch } from "@shopper/ui/components/switch";

type Props = {
  field: AnyFieldApi;
  label: string;
  /** Says what the switch does when it is on, tied to it for screen readers. */
  description?: string;
  onChange?: () => void;
};

/** A labelled on/off switch bound to a TanStack Form field. */
export function SwitchField({ field, label, description, onChange }: Props) {
  const descriptionId = `${field.name}-description`;
  return (
    <Field orientation="horizontal">
      <Switch
        id={field.name}
        checked={field.state.value}
        aria-describedby={description ? descriptionId : undefined}
        onCheckedChange={(checked) => {
          field.handleChange(checked);
          onChange?.();
        }}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      </FieldContent>
    </Field>
  );
}
