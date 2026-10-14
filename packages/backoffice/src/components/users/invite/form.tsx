import { inviteFormSchema } from "../../../schemas/users/invite/form";
import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../admin/form/sheet";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { focusFirstInvalid } from "../../../lib/focus";
import { roleLabel, type RoleView } from "../../../queries/roles";
import { useInvite, type InviteValues, type Revealed } from "../../../queries/users";

const CHANNELS = [
  { value: "email", label: "Email the invitation" },
  { value: "local", label: "Create a setup link" },
];

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
