import { roleFormSchema } from "../../schemas/roles/form";
import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { SheetClose, SheetFooter } from "@shopper/ui/components/sheet";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../admin/form/sheet";
import { TextField } from "../fields/text";
import { focusFirstInvalid } from "../../lib/focus";
import { PermissionMatrix } from "./matrix";
import { PERMISSION_GROUPS } from "../../lib/roles/permissions";
import { useSaveRole, type RoleValues, type RoleView } from "../../queries/roles";

type Props = {
  role?: RoleView;
  /** Codes this member holds, which is the most they can grant. */
  mine: ReadonlySet<string>;
  tillCodes: ReadonlySet<string>;
  /** Whether this member may change roles at all. */
  canWrite: boolean;
  onSaved: () => void;
};

/** Why the role can't be changed by this member, or undefined when they can edit it. */
export function lockReason(
  role: RoleView | undefined,
  mine: ReadonlySet<string>,
  canWrite: boolean,
) {
  if (role?.protectedOwner)
    return "The owner role always has every permission and can't be changed.";
  if (!canWrite) return "You don't have permission to change roles.";
  if (role?.permissionCodes.some((code) => !mine.has(code)))
    return "You can't change this role because it includes permissions you don't have.";
}

export function RoleForm({ role, mine, tillCodes, canWrite, onSaved }: Props) {
  const online = useOnline();
  const save = useSaveRole(role, onSaved);
  const locked = lockReason(role, mine, canWrite);
  const holdsEverything = PERMISSION_GROUPS.every(({ codes }) =>
    codes.every((code) => mine.has(code)),
  );
  const ceilingNote = holdsEverything
    ? undefined
    : "You can't grant permissions you don't have yourself.";
  const form = useForm({
    defaultValues: {
      name: role?.name ?? "",
      permissionCodes: role?.permissionCodes ?? [],
    } as RoleValues,
    validators: { onSubmit: roleFormSchema },
    onSubmit: ({ value }) => save.mutate({ ...value, name: value.name.trim() }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (!locked && online && !save.isPending) void form.handleSubmit();
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
      <FieldGroup
        role="region"
        aria-label="Role details and permissions"
        tabIndex={0}
        className="flex-1 overflow-y-auto px-4"
      >
        {(locked ?? ceilingNote) && (
          <p className="text-sm text-muted-foreground">{locked ?? ceilingNote}</p>
        )}
        <form.Field name="name">
          {(field) => (
            <TextField
              field={field}
              label="Name"
              autoFocus={!locked}
              autoComplete="off"
              disabled={!!locked}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="permissionCodes">
          {(field) => (
            <PermissionMatrix
              value={field.state.value}
              onChange={(codes) => {
                field.handleChange(codes);
                clearError();
              }}
              canGrant={mine}
              tillCodes={tillCodes}
              readOnly={!!locked}
            />
          )}
        </form.Field>
        {save.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      {locked ? (
        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      ) : (
        <FormFooter label="Save role" pending={save.isPending} online={online} />
      )}
    </form>
  );
}
