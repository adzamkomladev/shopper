import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { digitsText, rangeOf, sentence } from "../../../lib/catalogue/mappings/digits";
import type { MappingView } from "../../../schemas/catalogue/mappings";
import { RowActions } from "../../admin/row/actions";

type Props = {
  mappings: MappingView[];
  onEdit?: (mapping: MappingView) => void;
  onDelete?: (mapping: MappingView) => void;
};

const digits = ({ start, length }: { start: number; length: number }) =>
  sentence(digitsText(rangeOf(start + 1, length)!));
const decimals = (count: number) => `${count} ${count === 1 ? "decimal" : "decimals"}`;

export function MappingTable({ mappings, onEdit, onDelete }: Props) {
  const columns: DataTableColumn<MappingView>[] = [
    {
      id: "prefix",
      header: "Prefix",
      meta: { className: "font-medium tabular-nums" },
      cell: ({ row }) => row.original.prefix,
    },
    {
      id: "kind",
      header: "Label",
      cell: ({ row }) =>
        row.original.kind === "weight" ? `Weight in ${row.original.unit}` : "Price",
    },
    {
      id: "product",
      header: "Product code",
      cell: ({ row }) => digits(row.original.product),
    },
    {
      id: "value",
      header: "Value",
      cell: ({ row }) => `${digits(row.original.value)}, ${decimals(row.original.decimals)}`,
    },
  ];
  if (onEdit || onDelete)
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          id={row.original.id}
          name={`prefix ${row.original.prefix}`}
          onEdit={onEdit && (() => onEdit(row.original))}
          onDelete={onDelete && (() => onDelete(row.original))}
        />
      ),
    });
  return (
    <DataTable
      label="Barcode layouts"
      columns={columns}
      data={mappings}
      getRowId={(mapping) => mapping.id}
      className="min-h-0"
    />
  );
}
