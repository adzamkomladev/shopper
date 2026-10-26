import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { editButtonId } from "../../admin/row/actions";
import { formatDate } from "../../../lib/catalogue/detail/prices/groups";
import { roleLabel } from "../../../queries/roles";
import type { StatusChange, UserView } from "../../../queries/users";

type Props = {
  members: UserView[];
  /** Branch names by id; a branch the viewer can't see counts without a name. */
  branchNames: Map<string, string>;
  /** Only members who may change roles get the button, and only on members inside their branches. */
  onEditAccess?: (member: UserView) => void;
  /** Starts a role check for the member; only members who may assign roles get it. */
  onVerify?: (member: UserView) => void;
  /** Only members who may manage users get it; never on your own row, nor an owner's unless you are one. */
  onStatus?: (change: StatusChange) => void;
  self?: UserView;
};

export const statusButtonId = (id: string) => `member-status-${id}`;

export function MembersTable(props: Props) {
  const { members, branchNames, onEditAccess, onVerify, onStatus, self } = props;
  const columns: DataTableColumn<UserView>[] = [
    {
      id: "name",
      header: "Name",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {row.original.email}
            {!row.original.emailVerified && <Badge variant="outline">Not verified</Badge>}
            {/* Under md the Branches column folds into the name, so the actions stay on screen. */}
            <span className="md:hidden">
              · {branchesLabel(row.original.branchIds, branchNames)}
            </span>
            {row.original.deactivatedAt && (
              <Badge variant="secondary">
                Deactivated {formatDate(row.original.deactivatedAt)}
              </Badge>
            )}
          </span>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) =>
        roleLabel({ name: row.original.roleName, protectedOwner: row.original.protectedOwner }),
    },
    {
      id: "branches",
      header: "Branches",
      meta: { className: "hidden whitespace-normal md:table-cell" },
      cell: ({ row }) => branchesLabel(row.original.branchIds, branchNames),
    },
  ];
  if (onEditAccess || onStatus)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => {
        const member = row.original;
        const action = member.deactivatedAt ? "reactivate" : "deactivate";
        const reachable = within(self, member);
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {onVerify && !member.deactivatedAt && (
              <Button
                variant="outline"
                size="sm"
                aria-label={`Verify identity of ${member.name}`}
                onClick={() => onVerify(member)}
              >
                Verify identity
              </Button>
            )}
            {onEditAccess && reachable && !member.deactivatedAt && (
              <Button
                id={editButtonId(member.id)}
                variant="outline"
                size="sm"
                aria-label={`Edit access for ${member.name}`}
                onClick={() => onEditAccess(member)}
              >
                Edit access
              </Button>
            )}
            {onStatus &&
              reachable &&
              member.id !== self?.id &&
              (self?.protectedOwner || !member.protectedOwner) && (
                <Button
                  id={statusButtonId(member.id)}
                  variant="outline"
                  size="sm"
                  aria-label={`${action === "deactivate" ? "Deactivate" : "Reactivate"} ${member.name}`}
                  onClick={() => onStatus({ member, action })}
                >
                  {action === "deactivate" ? "Deactivate" : "Reactivate"}
                </Button>
              )}
          </div>
        );
      },
    });
  return (
    <DataTable
      label="Members"
      columns={columns}
      data={members}
      getRowId={(member) => member.id}
      className="max-h-96"
    />
  );
}

/** A branch-scoped manager reaches only members scoped inside their own branches; the server refuses the rest. */
function within(self: UserView | undefined, member: UserView) {
  if (!self?.branchIds.length) return true;
  return member.branchIds.length > 0 && member.branchIds.every((id) => self.branchIds.includes(id));
}

function branchesLabel(ids: string[], names: Map<string, string>) {
  if (ids.length === 0) return "All branches";
  const known = ids.flatMap((id) => names.get(id) ?? []);
  if (known.length === ids.length) return known.join(", ");
  return `${ids.length} ${ids.length === 1 ? "branch" : "branches"}`;
}
