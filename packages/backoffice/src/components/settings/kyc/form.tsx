import { useForm } from "@tanstack/react-form";
import { Checkbox } from "@shopper/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { ID_LABELS, ID_TYPES } from "../../../lib/kyc/ids";
import { useSaveSettings } from "../../../queries/settings/resource";
import { kycSettingsFormSchema, type KycSettingsView } from "../../../schemas/settings/kyc";
import { SwitchField } from "../../fields/switch";
import { SaveBar } from "../page";

/** Whether a credit check needs an ID document, and which kinds of ID an approver will accept. */
export function KycSettingsForm({ settings }: { settings: KycSettingsView }) {
  const online = useOnline();
  const save = useSaveSettings("kyc", "Identity check settings saved");
  const form = useForm({
    defaultValues: settings,
    validators: { onSubmit: kycSettingsFormSchema },
    onSubmit: ({ value }) => save.mutate({ idRequired: value.idRequired, idTypes: value.idTypes }),
    // The group's error is shown on its first box, which is also where focus goes.
    onSubmitInvalid: () => document.getElementById(`idType-${ID_TYPES[0]}`)?.focus(),
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  const clearError = () => {
    if (save.isError) save.reset();
  };
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="idRequired">
          {(field) => (
            <SwitchField
              field={field}
              label="Require an ID document"
              description="When on, a credit check cannot be sent for approval without an ID. When off, the person starting it may skip the ID."
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="idTypes">
          {(field) => {
            const message = field.state.meta.errors[0]?.message;
            return (
              <FieldSet>
                <FieldLegend variant="label">Accepted ID types</FieldLegend>
                <FieldDescription>
                  An approver checks the document by eye. Only these types can be entered.
                </FieldDescription>
                <FieldGroup className="gap-3">
                  {ID_TYPES.map((type) => (
                    <Field key={type} orientation="horizontal">
                      <Checkbox
                        id={`idType-${type}`}
                        checked={field.state.value.includes(type)}
                        aria-invalid={!!message}
                        onCheckedChange={(checked) => {
                          field.handleChange(
                            ID_TYPES.filter((each) =>
                              each === type ? checked === true : field.state.value.includes(each),
                            ),
                          );
                          clearError();
                        }}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor={`idType-${type}`}>{ID_LABELS[type]}</FieldLabel>
                      </FieldContent>
                    </Field>
                  ))}
                </FieldGroup>
                {message && <FieldError>{message}</FieldError>}
              </FieldSet>
            );
          }}
        </form.Field>
      </FieldGroup>
      <SaveBar
        label="Save identity check settings"
        pending={save.isPending}
        error={save.error?.message}
      />
    </form>
  );
}
