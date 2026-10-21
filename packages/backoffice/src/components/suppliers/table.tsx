import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { RowActions } from "../admin/row/actions";
import type { SupplierView } from "../../queries/suppliers";

const FROM_MD = "hidden md:table-cell";
const FROM_LG = "hidden lg:table-cell";

type Props = { suppliers: SupplierView[]; onEdit?: (supplier: SupplierView) => void };

const dash = <span className="text-muted-foreground">—</span>;

export function SupplierTable({ suppliers, onEdit }: Props) {
  const columns: DataTableColumn<SupplierView>[] = [
    {
      id: "name",
      header: "Supplier",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "phone",
      header: "Phone",
      meta: { className: FROM_MD },
      cell: ({ row }) => row.original.phone || dash,
    },
    {
      id: "email",
      header: "Email",
      meta: { className: `${FROM_LG} whitespace-normal break-all` },
      cell: ({ row }) => row.original.email || dash,
    },
    {
      id: "tin",
      header: "TIN",
      meta: { className: FROM_LG },
      cell: ({ row }) => row.original.tin || dash,
    },
  ];
  if (onEdit)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          id={row.original.id}
          name={row.original.name}
          onEdit={() => onEdit(row.original)}
        />
      ),
    });
  return (
    <DataTable
      label="Suppliers"
      columns={columns}
      data={suppliers}
      getRowId={(supplier) => supplier.id}
      className="min-h-0"
    />
  );
}
