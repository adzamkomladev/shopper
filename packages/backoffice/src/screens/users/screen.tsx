import { useRef } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { MailIcon } from "lucide-react";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { FormSheet } from "../../components/admin/form/sheet";
import { PageHeader } from "../../components/admin/page/header";
import { editButtonId } from "../../components/admin/row/actions";
import { EmptyList } from "../../components/admin/states";
import { usePanel } from "../../hooks/admin/panel";
import { ApiError } from "../../api/client";
import { permissionsQuery } from "../../queries/session/permissions";
import { sessionQuery } from "../../queries/session/session";
import { roleLabel, rolesQuery, type RoleView } from "../../queries/roles";
import { CancelInvitationDialog } from "../../components/users/cancel/dialog";
import { ChangeRoleForm } from "../../components/users/change/role/form";
import { InvitationsTable, cancelButtonId } from "../../components/users/invitations/table";
import { InviteForm } from "../../components/users/invite/form";
import { KycStartSheet } from "../../components/kyc/start";
import { MembersTable } from "../../components/users/members/table";
import {
  invitationsQuery,
  useReissue,
  usersQuery,
  type InvitationView,
  type Revealed,
  type UserView,
} from "../../queries/users";
import { SetupLinkDialog } from "../../components/users/setup/link/dialog";

const NO_ROLES: RoleView[] = [];

export function UsersScreen() {
  const { data: members } = useSuspenseQuery(usersQuery());
  const { data: allInvitations } = useSuspenseQuery(invitationsQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: session } = useSuspenseQuery(sessionQuery());
  // Naming roles needs role.read, which a member who can only list users may not hold.
  const roleList = useQuery({ ...rolesQuery(), retry: false });
  const roles = roleList.data ?? NO_ROLES;
  const roleListPermissionDenied =
    roleList.error instanceof ApiError && roleList.error.status === 403;
  const currentMember = members.find((member) => member.id === session?.user.id);
  const grantableRoles = roles.filter(
    (role) =>
      (currentMember?.protectedOwner || !role.protectedOwner) &&
      role.permissionCodes.every((code) => held.includes(code)),
  );
  const addRef = useRef<HTMLButtonElement>(null);
  const invite = usePanel(addRef);
  const roleChange = usePanel<UserView>(addRef);
  const verification = usePanel<UserView>(addRef);
  const link = usePanel<Revealed>(addRef);
  const cancellation = usePanel<InvitationView>(addRef);
  const reissue = useReissue((revealed) => link.show(revealed));
  const canWriteRoles = held.includes("role.write");
  const canAssign = canWriteRoles && roleList.data !== undefined && grantableRoles.length > 0;
  const canInvite = canAssign && held.includes("user.write");
  const noPanelOpen =
    !invite.open && !roleChange.open && !verification.open && !link.open && !cancellation.open;
  const shortcuts = useShortcuts({ I: () => canInvite && noPanelOpen && invite.show() });
  // A replaced invitation is history that only repeats the one that replaced it.
  const invitations = allInvitations.filter((invitation) => invitation.status !== "replaced");
  const roleNames = new Map(roles.map((role) => [role.id, roleLabel(role)]));
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Users"
        action={
          canInvite
            ? { label: "Invite user", shortcut: "I", onClick: () => invite.show(), ref: addRef }
            : undefined
        }
      />
      {!canWriteRoles && (
        <p className="-mt-3 text-sm text-muted-foreground">
          You can see who has access. Changing roles or inviting people needs the role permission.
        </p>
      )}
      {canWriteRoles && roleList.isPending && (
        <p className="-mt-3 text-sm text-muted-foreground" role="status">
          Loading role choices…
        </p>
      )}
      {canWriteRoles && roleList.isError && !roleList.data && (
        <p className="-mt-3 text-sm text-muted-foreground" role="status">
          {roleListPermissionDenied
            ? "Role choices aren’t available because you can’t read the role list. Check your access and refresh."
            : "Role choices couldn’t load. Check your connection and refresh to try again."}
        </p>
      )}
      {canWriteRoles && roleList.data && grantableRoles.length === 0 && (
        <p className="-mt-3 text-sm text-muted-foreground" role="status">
          No roles are available within your permission level to assign.
        </p>
      )}
      {canAssign && !held.includes("user.write") && (
        <p className="-mt-3 text-sm text-muted-foreground">
          You can change roles. Inviting people needs the user permission.
        </p>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <MembersTable
          members={members}
          onVerify={
            canAssign ? (member) => verification.show(member, editButtonId(member.id)) : undefined
          }
          onChangeRole={
            canAssign ? (member) => roleChange.show(member, editButtonId(member.id)) : undefined
          }
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Invitations</h2>
        {invitations.length === 0 ? (
          <EmptyList
            icon={MailIcon}
            title="No invitations yet"
            description="Invitations you send show up here with their status, so you can send them again or cancel them."
          />
        ) : (
          <InvitationsTable
            invitations={invitations}
            roleNames={roleNames}
            actions={
              canInvite
                ? {
                    pending: reissue.isPending,
                    onReissue: (invitation) => reissue.mutate(invitation),
                    onCancel: (invitation) =>
                      cancellation.show(invitation, cancelButtonId(invitation.id)),
                  }
                : undefined
            }
          />
        )}
      </section>
      <FormSheet
        open={invite.open}
        onOpenChange={invite.setOpen}
        title="Invite a user"
        description="They get a link to choose a password and sign in with the role you pick."
        // The setup-link dialog opens as this sheet closes and keeps focus.
        restoreFocus={() => !link.open && invite.restoreFocus()}
      >
        <InviteForm
          roles={grantableRoles}
          reveal={(revealed) => link.show(revealed)}
          onDone={() => invite.setOpen(false)}
        />
      </FormSheet>
      <FormSheet
        open={roleChange.open}
        onOpenChange={roleChange.setOpen}
        title="Change role"
        description={`Choose the role ${roleChange.value?.name ?? "this member"} signs in with.`}
        restoreFocus={roleChange.restoreFocus}
      >
        {roleChange.value && (
          <ChangeRoleForm
            key={roleChange.value.id}
            member={roleChange.value}
            roles={grantableRoles}
            onSaved={() => roleChange.setOpen(false)}
          />
        )}
      </FormSheet>
      <KycStartSheet
        open={verification.open}
        onOpenChange={verification.setOpen}
        restoreFocus={verification.restoreFocus}
        subject={verification.value && { kind: "member", id: verification.value.id }}
      />
      <SetupLinkDialog
        revealed={link.value}
        open={link.open}
        onOpenChange={link.setOpen}
        restoreFocus={link.restoreFocus}
      />
      <CancelInvitationDialog
        invitation={cancellation.value}
        open={cancellation.open}
        onOpenChange={cancellation.setOpen}
        restoreFocus={cancellation.restoreFocus}
      />
    </div>
  );
}
