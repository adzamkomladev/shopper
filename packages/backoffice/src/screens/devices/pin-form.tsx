import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import * as v from "valibot";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../components/admin/form-sheet";
import { SelectField } from "../../components/fields/select";
import { TextField } from "../../components/fields/text";
import { focusFirstInvalid } from "../../lib/focus";
import { useSavePin } from "./queries";

const pinFormSchema = v.object({
  userId: v.pipe(v.string(), v.nonEmpty("Choose a cashier")),
  pin: v.pipe(v.string(), v.regex(/^\d{4,8}$/, "Use 4 to 8 digits, like 4829")),
});

type Props = {
  members: { id: string; name: string }[];
  unavailableMessage?: string;
  onSaved: () => void;
};

export function PinForm({ members, unavailableMessage, onSaved }: Props) {
  const online = useOnline();
  const save = useSavePin(onSaved);
  const form = useForm({
    defaultValues: { userId: "", pin: "" },
    validators: { onSubmit: pinFormSchema },
    onSubmit: ({ value }) =>
      save.mutate({
        ...value,
        name: members.find((member) => member.id === value.userId)?.name ?? "",
      }),
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
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        <form.Field name="userId">
          {(field) => (
            <SelectField
              field={field}
              label="Cashier"
              placeholder="Choose a cashier"
              autoFocus
              options={members.map((member) => ({ value: member.id, label: member.name }))}
            />
          )}
        </form.Field>
        <form.Field name="pin">
          {(field) => (
            <TextField
              field={field}
              label="PIN"
              description="They type it on the till to sign in. It replaces any PIN they have."
              type="password"
              inputMode="numeric"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        {unavailableMessage && (
          <p className="text-sm text-muted-foreground" role="status">
            {unavailableMessage}
          </p>
        )}
        {save.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Save PIN" pending={save.isPending} online={online} />
    </form>
  );
}
