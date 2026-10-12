import { useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { FormSheet } from "../../components/admin/form-sheet";
import { PageHeader } from "../../components/admin/page-header";
import { editButtonId } from "../../components/admin/row-actions";
import { usePanel } from "../../components/admin/use-panel";
import { permissionsQuery } from "../../session/permissions";
import { RoleForm, lockReason } from "./form";
import { permissionsListQuery, rolesQuery, type RoleView } from "./queries";
import { RoleTable } from "./table";

export function RolesScreen() {
  const { data: roles } = useSuspenseQuery(rolesQuery());
  const { data: permissions } = useSuspenseQuery(permissionsListQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const addRef = useRef<HTMLButtonElement>(null);
  const form = usePanel<RoleView>(addRef);
  const mine = new Set(held);
  const canWrite = mine.has("role.write");
  const tillCodes = new Set(permissions.filter((row) => row.tillAllowed).map((row) => row.code));
  const shortcuts = useShortcuts({ N: () => canWrite && !form.open && form.show() });
  const current = form.value;
  const title = !current
    ? "New role"
    : current.protectedOwner
      ? "Owner role"
      : lockReason(current, mine, canWrite)
        ? "View role"
        : "Edit role";
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Roles"
        action={
          canWrite
            ? { label: "New role", shortcut: "N", onClick: () => form.show(), ref: addRef }
            : undefined
        }
      />
      <RoleTable
        roles={roles}
        total={permissions.length}
        canWrite={canWrite}
        mine={mine}
        onOpen={(role) => form.show(role, editButtonId(role.id))}
      />
      <FormSheet
        open={form.open}
        onOpenChange={form.setOpen}
        title={title}
        description={
          current
            ? "What members with this role can do."
            : "Name the role and choose what it can do."
        }
        restoreFocus={form.restoreFocus}
        className="sm:max-w-xl"
      >
        <RoleForm
          key={current?.id ?? "new"}
          role={current}
          mine={mine}
          tillCodes={tillCodes}
          canWrite={canWrite}
          onSaved={() => form.setOpen(false)}
        />
      </FormSheet>
    </div>
  );
}
