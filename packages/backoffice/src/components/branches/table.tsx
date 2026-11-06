import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { RowActions } from "../admin/row/actions";

type Branch = { id: string; name: string; storeId: string; alertPhones: string[] };
type Props = {
  branches: Branch[];
  storeNames: Map<string, string>;
  onEdit?: (branch: Branch) => void;
  onDelete?: (branch: Branch) => void;
  /** Opens the branch's online ordering: pickup, delivery, hours and slots. */
  onOrders?: (branch: Branch) => void;
};

export const ordersButtonId = (id: string) => `orders-${id}`;

export function BranchTable({ branches, storeNames, onEdit, onDelete, onOrders }: Props) {
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
  if (onEdit || onDelete || onOrders)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <RowActions
            id={row.original.id}
            name={row.original.name}
            onEdit={onEdit && (() => onEdit(row.original))}
            onDelete={onDelete && (() => onDelete(row.original))}
          />
          {onOrders && (
            <Button
              id={ordersButtonId(row.original.id)}
              variant="outline"
              size="sm"
              aria-label={`Online orders at ${row.original.name}`}
              onClick={() => onOrders(row.original)}
            >
              Online orders
            </Button>
          )}
        </div>
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
