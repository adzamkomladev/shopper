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
import { roleLabel, type RoleView } from "../roles/queries";
import { useInvite, type InviteValues, type Revealed } from "./queries";

const CHANNELS = [
  { value: "email", label: "Email the invitation" },
  { value: "local", label: "Create a setup link" },
];

const inviteFormSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Enter an email address"),
    v.email("Enter an email address like ama@example.com"),
  ),
  roleId: v.pipe(v.string(), v.nonEmpty("Choose a role")),
  channel: v.picklist(["email", "local"]),
});

type Props = {
  roles: RoleView[];
  reveal: (revealed: Revealed) => void;
  onDone: () => void;
};

export function InviteForm({ roles, reveal, onDone }: Props) {
  const online = useOnline();
  const invite = useInvite(reveal, onDone);
  const form = useForm({
    defaultValues: { email: "", roleId: "", channel: "email" } as InviteValues,
    validators: { onSubmit: inviteFormSchema },
    onSubmit: ({ value }) => invite.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !invite.isPending) void form.handleSubmit();
    },
  });
  const clearError = () => {
    if (invite.isError) invite.reset();
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
        <form.Field name="email">
          {(field) => (
            <TextField
              field={field}
              label="Email"
              type="email"
              autoFocus
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="roleId">
          {(field) => (
            <SelectField
              field={field}
              label="Role"
              placeholder="Choose a role"
              options={roles.map((role) => ({ value: role.id, label: roleLabel(role) }))}
            />
          )}
        </form.Field>
        <form.Field name="channel">
          {(field) => <SelectField field={field} label="How to send it" options={CHANNELS} />}
        </form.Field>
        {invite.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{invite.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Send invitation" pending={invite.isPending} online={online} />
    </form>
  );
}
