import { useForm } from "@tanstack/react-form";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { nextRun } from "../../../lib/statements/nextrun";
import { useSaveSettings } from "../../../queries/settings/resource";
import {
  statementsFormSchema,
  statementsValues,
  toStatementsBody,
  type StatementSettingsView,
} from "../../../schemas/settings/statements";
import { CheckField } from "../../fields/check";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { SaveBar } from "../page";

const SCHEDULES = [
  { value: "off", label: "Off" },
  { value: "monthly", label: "Monthly" },
];

/** Whether statements go out on their own, on which day, over which channels, and to whom. */
export function StatementsForm({ settings }: { settings: StatementSettingsView }) {
  const online = useOnline();
  const save = useSaveSettings("statements", "Statement settings saved");
  const form = useForm({
    defaultValues: statementsValues(settings),
    validators: { onSubmit: statementsFormSchema },
    onSubmit: ({ value }) => save.mutate(toStatementsBody(value)),
    onSubmitInvalid: focusFirstInvalid,
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
        <form.Field name="schedule">
          {(field) => (
            <SelectField
              field={field}
              label="Send statements"
              options={SCHEDULES}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values}>
          {(values) =>
            values.schedule === "monthly" && (
              <>
                <form.Field name="day">
                  {(field) => (
                    <TextField
                      field={field}
                      label="Day of the month"
                      description="1 to 28, so every month has one. Accra time."
                      inputMode="numeric"
                      autoComplete="off"
                      onChange={clearError}
                    />
                  )}
                </form.Field>
                <form.Field name="sms">
                  {(field) => (
                    <CheckField field={field} label="Send by SMS" onChange={clearError} />
                  )}
                </form.Field>
                <form.Field name="email">
                  {(field) => (
                    <CheckField
                      field={field}
                      label="Send by email"
                      description="Customers without an email address get the SMS only."
                      onChange={clearError}
                    />
                  )}
                </form.Field>
                <form.Field name="minBalance">
                  {(field) => (
                    <TextField
                      field={field}
                      label="Minimum balance (GH₵)"
                      description="Customers who owe less than this do not get a statement."
                      inputMode="decimal"
                      autoComplete="off"
                      onChange={clearError}
                    />
                  )}
                </form.Field>
                <p className="text-sm text-muted-foreground">
                  Next run:{" "}
                  {/^\d{1,2}$/.test(values.day) && +values.day >= 1 && +values.day <= 28
                    ? nextRun(Number(values.day))
                    : "choose a day from 1 to 28"}
                </p>
              </>
            )
          }
        </form.Subscribe>
      </FieldGroup>
      <SaveBar
        label="Save statement settings"
        pending={save.isPending}
        error={save.error?.message}
      />
    </form>
  );
}
