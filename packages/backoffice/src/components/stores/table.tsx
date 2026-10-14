import { money } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { RowActions } from "../admin/row/actions";
import type { StoreView } from "../../schemas/management";

type Props = {
  stores: StoreView[];
  /** Both are left out for a member who may only view stores. */
  onEdit?: (store: StoreView) => void;
  onDelete?: (store: StoreView) => void;
};

export function StoreTable({ stores, onEdit, onDelete }: Props) {
  const columns: DataTableColumn<StoreView>[] = [
    {
      id: "name",
      header: "Store",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "rounding",
      header: "Cash rounding",
      meta: { align: "right" },
      cell: ({ row }) => <Money amount={money(row.original.cashRoundingStep)} />,
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
      label="Stores"
      columns={columns}
      data={stores}
      getRowId={(store) => store.id}
      className="min-h-0"
    />
  );
}
