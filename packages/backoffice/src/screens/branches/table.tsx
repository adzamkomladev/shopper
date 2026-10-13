import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { RowActions } from "../../components/admin/row-actions";

type Branch = { id: string; name: string; storeId: string };
type Props = {
  branches: Branch[];
  storeNames: Map<string, string>;
  onEdit?: (branch: Branch) => void;
  onDelete?: (branch: Branch) => void;
};

export function BranchTable({ branches, storeNames, onEdit, onDelete }: Props) {
  const columns: DataTableColumn<Branch>[] = [
    {
      id: "name",
      header: "Branch",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "store",
      header: "Store",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => storeNames.get(row.original.storeId) ?? "Unknown store",
    },
  ];
  if (onEdit || onDelete)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          id={row.original.id}
          name={row.original.name}
          onEdit={onEdit && (() => onEdit(row.original))}
          onDelete={onDelete && (() => onDelete(row.original))}
        />
      ),
    });
  return (
    <DataTable
      label="Branches"
      columns={columns}
      data={branches}
      getRowId={(branch) => branch.id}
      className="min-h-0"
    />
  );
}
