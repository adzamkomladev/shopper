import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { v7 } from "uuid";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ApiError } from "../../../api/client";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveCustomer } from "../../../queries/customers/save";
import type { CustomerView } from "../../../queries/customers/types";
import { customerFormSchema, customerValues, emptyCustomer } from "../../../schemas/customers/form";
import { FormFooter } from "../../admin/form/sheet";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";

const KINDS = [
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
] as const;

const FIELDS = ["name", "phone", "kind", "businessName", "tin", "email"];

type Props = { customer?: CustomerView; onSaved: (saved: CustomerView) => void };

/** Adds a customer, or edits `customer`. The business name only appears for a business. */
export function CustomerForm({ customer, onSaved }: Props) {
  const online = useOnline();
  // One id for the life of the form, so a retried create replays instead of adding twice.
  const [id] = useState(() => v7());
  const save = useSaveCustomer(id, customer, onSaved);
  const form = useForm({
    defaultValues: customer ? customerValues(customer) : emptyCustomer,
    validators: { onSubmit: customerFormSchema },
    onSubmit: ({ value }) => save.mutate(value),
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
  // A refusal that names a field is shown on it; any other is shown above the buttons.
  const refused = save.error instanceof ApiError ? save.error.field : undefined;
  const onField = (name: string) => (refused === name ? save.error?.message : undefined);
  const general = save.error && !FIELDS.includes(refused ?? "");
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        <form.Field name="name">
          {(field) => (
            <TextField
              field={field}
              label="Name"
              autoFocus
              autoComplete="off"
              serverError={onField("name")}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <TextField
              field={field}
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              serverError={onField("phone")}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="kind">
          {(field) => <SelectField field={field} label="Type" options={KINDS} />}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.kind}>
          {(kind) =>
            kind === "business" && (
              <form.Field name="businessName">
                {(field) => (
                  <TextField
                    field={field}
                    label="Business name"
                    autoComplete="off"
                    serverError={onField("businessName")}
                    onChange={clearError}
                  />
                )}
              </form.Field>
            )
          }
        </form.Subscribe>
        <form.Field name="tin">
          {(field) => (
            <TextField
              field={field}
              label="TIN"
              description="Tax identification number, if they have one."
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              serverError={onField("tin")}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <TextField
              field={field}
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              serverError={onField("email")}
              onChange={clearError}
            />
          )}
        </form.Field>
        {general && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Save customer" pending={save.isPending} online={online} />
    </form>
  );
}
