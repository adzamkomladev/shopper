import { Link } from "@tanstack/react-router";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { quantityLabel } from "../../../../lib/inventory/format";
import type { StockItem } from "../../../../queries/inventory/types";
import { LowBadge, NegativeBadge } from "../badge";

// A phone keeps the product, what is on hand and whether it is low; the level needs a tablet.
const FROM_MD = "hidden md:table-cell";

type Props = { items: StockItem[]; branchId: string; onEndReached: () => void };

export function StockTable({ items, branchId, onEndReached }: Props) {
  const columns: DataTableColumn<StockItem>[] = [
    {
      id: "product",
      header: "Product",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            to="/stock/products/$productId"
            params={{ productId: row.original.productId }}
            search={{ branch: branchId }}
            className="w-fit font-medium hover:underline"
          >
            {row.original.name}
          </Link>
          <span className="text-xs text-muted-foreground">{row.original.sku}</span>
        </div>
      ),
    },
    {
      id: "onHand",
      header: "On hand",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {quantityLabel(row.original.onHandThousandths, row.original.baseUnit)}
        </span>
      ),
    },
    {
      id: "level",
      header: "Reorder level",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) =>
        row.original.levelThousandths === null ? (
          <span className="text-muted-foreground">Not set</span>
        ) : (
          <span className="tabular-nums">
            {quantityLabel(row.original.levelThousandths, row.original.baseUnit)}
          </span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.negative ? <NegativeBadge /> : row.original.low ? <LowBadge /> : null,
    },
  ];
  return (
    <DataTable
      label="Stock on hand"
      columns={columns}
      data={items}
      getRowId={(item) => item.productId}
      onEndReached={onEndReached}
      className="min-h-0"
    />
  );
}
