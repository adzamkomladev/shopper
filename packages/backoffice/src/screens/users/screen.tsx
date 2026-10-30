import { useRef } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { MailIcon, UserXIcon } from "lucide-react";
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
import { AccessForm } from "../../components/users/access/form";
import { MemberStatusDialog } from "../../components/users/status/dialog";
import { StatusTabs } from "../../components/users/status/tabs";
import { InvitationsTable, cancelButtonId } from "../../components/users/invitations/table";
import { InviteForm } from "../../components/users/invite/form";
import { KycStartSheet } from "../../components/kyc/start";
import { MembersTable, statusButtonId, unlockButtonId } from "../../components/users/members/table";
import {
  accessBranchesQuery,
  invitationsQuery,
  useReissue,
  usersQuery,
  type InvitationView,
  type Revealed,
  type StatusChange,
  type UserView,
} from "../../queries/users";
import { SetupLinkDialog } from "../../components/users/setup/link/dialog";
import { SetupStepLink } from "../../components/setup/back";

const NO_ROLES: RoleView[] = [];
const NO_BRANCHES: { id: string; name: string }[] = [];

export function UsersScreen() {
  const { status } = useSearch({ from: "/_shop/users" });
  const { data: everyone } = useSuspenseQuery(usersQuery());
  const { data: allInvitations } = useSuspenseQuery(invitationsQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: session } = useSuspenseQuery(sessionQuery());
  // Naming roles needs role.read, which a member who can only list users may not hold.
  const roleList = useQuery({ ...rolesQuery(), retry: false });
  const roles = roleList.data ?? NO_ROLES;
  const roleListPermissionDenied =
    roleList.error instanceof ApiError && roleList.error.status === 403;
  const currentMember = everyone.find((member) => member.id === session?.user.id);
  const deactivated = everyone.filter((member) => member.deactivatedAt);
  const members = status === "deactivated" ? deactivated : everyone.filter((m) => !m.deactivatedAt);
  const grantableRoles = roles.filter(
    (role) =>
      (currentMember?.protectedOwner || !role.protectedOwner) &&
      role.permissionCodes.every((code) => held.includes(code)),
  );
  const addRef = useRef<HTMLButtonElement>(null);
  const invite = usePanel(addRef);
  const roleChange = usePanel<UserView>(addRef);
  const statusChange = usePanel<StatusChange>(addRef);
  const verification = usePanel<UserView>(addRef);
  const link = usePanel<Revealed>(addRef);
  const cancellation = usePanel<InvitationView>(addRef);
  const reissue = useReissue((revealed) => link.show(revealed));
  const canWriteRoles = held.includes("role.write");
  // Branch names come with the branches you may hand out, which needs role.write.
  const branchList = useQuery({ ...accessBranchesQuery(), enabled: canWriteRoles, retry: false });
  const branches = branchList.data?.branches ?? NO_BRANCHES;
  const canAssign = canWriteRoles && roleList.data !== undefined && grantableRoles.length > 0;
  const canInvite = canAssign && held.includes("user.write");
  const noPanelOpen =
    !invite.open &&
    !roleChange.open &&
    !statusChange.open &&
    !verification.open &&
    !link.open &&
    !cancellation.open;
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
        <StatusTabs
          status={status}
          counts={{ active: everyone.length - deactivated.length, deactivated: deactivated.length }}
        >
          {members.length === 0 ? (
            <EmptyList
              icon={UserXIcon}
              title="No deactivated members"
              description="Members you deactivate show up here, so you can bring them back."
            />
          ) : (
            <MembersTable
              members={members}
              branchNames={new Map(branches.map((branch) => [branch.id, branch.name]))}
              self={currentMember}
              onVerify={
                canAssign
                  ? (member) => verification.show(member, editButtonId(member.id))
                  : undefined
              }
              onEditAccess={
                canAssign && branchList.data
                  ? (member) => roleChange.show(member, editButtonId(member.id))
                  : undefined
              }
              onStatus={
                // The server checks the target's role against your own, which needs role.write too.
                canWriteRoles && held.includes("user.write")
                  ? (change) => statusChange.show(change, statusButtonId(change.member.id))
                  : undefined
              }
              onUnlock={
                canWriteRoles && held.includes("staff.unlock")
                  ? (member) =>
                      statusChange.show({ member, action: "unlock" }, unlockButtonId(member.id))
                  : undefined
              }
            />
          )}
        </StatusTabs>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Invitations</h2>
        {invitations.length === 0 ? (
          <EmptyList
            icon={MailIcon}
            title="No invitations yet"
            description="Invitations you send show up here with their status, so you can send them again or cancel them."
          >
            <SetupStepLink step="team" />
          </EmptyList>
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
        title="Edit access"
        description={`Choose the role ${roleChange.value?.name ?? "this member"} signs in with and where they work.`}
        restoreFocus={roleChange.restoreFocus}
      >
        {roleChange.value && (
          <AccessForm
            key={roleChange.value.id}
            // The refetched row, so a retry after a partial save compares against what was saved.
            member={everyone.find((m) => m.id === roleChange.value?.id) ?? roleChange.value}
            roles={grantableRoles}
            branches={branches}
            onSaved={() => roleChange.setOpen(false)}
          />
        )}
      </FormSheet>
      <MemberStatusDialog
        change={statusChange.value}
        open={statusChange.open}
        onOpenChange={statusChange.setOpen}
        restoreFocus={statusChange.restoreFocus}
      />
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
