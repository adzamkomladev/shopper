import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Checkbox } from "@shopper/ui/components/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../admin/form/sheet";
import { SelectField } from "../../fields/select";
import { SwitchField } from "../../fields/switch";
import { roleLabel, type RoleView } from "../../../queries/roles";
import { useSaveAccess, type AccessValues, type UserView } from "../../../queries/users";

type Props = {
  member: UserView;
  roles: RoleView[];
  /** What the person editing may hand out: their own branches, or every branch. */
  branches: { id: string; name: string }[];
  onSaved: () => void;
};

const NONE_ID = "branches-error";

/** A member's role and the branches they work at, saved together (Mod+Enter). */
export function AccessForm({ member, roles, branches, onSaved }: Props) {
  const online = useOnline();
  const save = useSaveAccess(member, onSaved);
  const form = useForm({
    defaultValues: {
      roleId: member.roleId,
      everywhere: member.branchIds.length === 0,
      branchIds: member.branchIds,
    } as AccessValues,
    validators: {
      onSubmit: ({ value }) =>
        !value.everywhere && value.branchIds.length === 0
          ? { fields: { branchIds: "Choose at least one branch" } }
          : undefined,
    },
    onSubmit: ({ value }) => save.mutate(value),
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  const clearError = () => save.isError && save.reset();
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
        {/* A member whose role the editor can't grant keeps it as a choice beside the ones they can. */}
        <form.Field name="roleId">
          {(field) => (
            <SelectField
              field={field}
              label="Role"
              autoFocus
              options={(roles.some((role) => role.id === member.roleId)
                ? roles
                : [
                    {
                      id: member.roleId,
                      name: member.roleName,
                      protectedOwner: member.protectedOwner,
                    },
                    ...roles,
                  ]
              ).map((role) => ({ value: role.id, label: roleLabel(role) }))}
            />
          )}
        </form.Field>
        <form.Field name="everywhere">
          {(field) => (
            <SwitchField
              field={field}
              label="All branches"
              disabled={member.protectedOwner}
              description={
                member.protectedOwner
                  ? "The owner works at every branch."
                  : "Off limits them to the branches you tick: sign-in, approvals and reports."
              }
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.everywhere}>
          {(everywhere) =>
            !everywhere && (
              <form.Field name="branchIds">
                {(field) => {
                  const message = field.state.meta.errors[0] as string | undefined;
                  return (
                    <FieldSet data-invalid={!!message}>
                      <FieldLegend variant="label">Branches</FieldLegend>
                      <div className="flex flex-col divide-y rounded-lg border">
                        {branches.map((branch) => (
                          <Field key={branch.id} orientation="horizontal" className="px-4 py-3">
                            <Checkbox
                              id={`branch-${branch.id}`}
                              checked={field.state.value.includes(branch.id)}
                              aria-describedby={message ? NONE_ID : undefined}
                              onCheckedChange={(on) => {
                                field.handleChange(
                                  on === true
                                    ? [...field.state.value, branch.id]
                                    : field.state.value.filter((id: string) => id !== branch.id),
                                );
                                clearError();
                              }}
                            />
                            <FieldLabel htmlFor={`branch-${branch.id}`}>{branch.name}</FieldLabel>
                          </Field>
                        ))}
                      </div>
                      {message && <FieldError id={NONE_ID}>{message}</FieldError>}
                    </FieldSet>
                  );
                }}
              </form.Field>
            )
          }
        </form.Subscribe>
        {save.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Save access" pending={save.isPending} online={online} />
    </form>
  );
}
