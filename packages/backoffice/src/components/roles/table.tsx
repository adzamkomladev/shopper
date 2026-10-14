import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { editButtonId } from "../admin/row/actions";
import { lockReason } from "./form";
import { roleLabel, type RoleView } from "../../queries/roles";

type Props = {
  roles: RoleView[];
  /** How many permissions exist, so each row can say "5 of 26". */
  total: number;
  canWrite: boolean;
  mine: ReadonlySet<string>;
  onOpen: (role: RoleView) => void;
};

export function RoleTable({ roles, total, canWrite, mine, onOpen }: Props) {
  const columns: DataTableColumn<RoleView>[] = [
    {
      id: "name",
      header: "Role",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => roleLabel(row.original),
    },
    {
      id: "permissions",
      header: "Permissions",
      meta: { className: "tabular-nums" },
      cell: ({ row }) => `${row.original.permissionCodes.length} of ${total}`,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const editable = !lockReason(row.original, mine, canWrite);
        return (
          <div className="flex justify-end">
            <Button
              id={editButtonId(row.original.id)}
              variant="outline"
              size="sm"
              aria-label={`${editable ? "Edit" : "View"} permissions for ${roleLabel(row.original)}`}
              onClick={() => onOpen(row.original)}
            >
              {editable ? "Edit permissions" : "View permissions"}
            </Button>
          </div>
        );
      },
    },
  ];
  return (
    <DataTable
      label="Roles"
      columns={columns}
      data={roles}
      getRowId={(role) => role.id}
      className="min-h-0"
    />
  );
}
