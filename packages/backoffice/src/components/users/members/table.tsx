import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { editButtonId } from "../../admin/row/actions";
import { roleLabel } from "../../../queries/roles";
import type { UserView } from "../../../queries/users";

type Props = {
  members: UserView[];
  /** Only members who may change roles get the button. */
  onChangeRole?: (member: UserView) => void;
};

export function MembersTable({ members, onChangeRole }: Props) {
  const columns: DataTableColumn<UserView>[] = [
    {
      id: "name",
      header: "Name",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="flex items-center gap-2 text-muted-foreground">
            {row.original.email}
            {!row.original.emailVerified && <Badge variant="outline">Not verified</Badge>}
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
  ];
  if (onChangeRole)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            id={editButtonId(row.original.id)}
            variant="outline"
            size="sm"
            aria-label={`Change role for ${row.original.name}`}
            onClick={() => onChangeRole(row.original)}
          >
            Change role
          </Button>
        </div>
      ),
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
