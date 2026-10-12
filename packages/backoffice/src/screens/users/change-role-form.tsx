import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../components/admin/form-sheet";
import { SelectField } from "../../components/fields/select";
import { roleLabel, type RoleView } from "../roles/queries";
import { useAssignRole, type UserView } from "./queries";

type Props = { member: UserView; roles: RoleView[]; onSaved: () => void };

export function ChangeRoleForm({ member, roles, onSaved }: Props) {
  const online = useOnline();
  const assign = useAssignRole(member, onSaved);
  const form = useForm({
    defaultValues: { roleId: member.roleId },
    onSubmit: ({ value }) => assign.mutate(value.roleId),
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !assign.isPending) void form.handleSubmit();
    },
  });
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
        <form.Field name="roleId">
          {(field) => (
            <SelectField
              field={field}
              label="Role"
              autoFocus
              options={roles.map((role) => ({ value: role.id, label: roleLabel(role) }))}
            />
          )}
        </form.Field>
        {assign.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{assign.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Save role" pending={assign.isPending} online={online} />
    </form>
  );
}
