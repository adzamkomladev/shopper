import { HistoryIcon } from "lucide-react";
import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { changeLabel, quantityLabel, REASON_LABELS } from "../../../../lib/inventory/format";
import { shiftTime } from "../../../../lib/shifts/format";
import type { StockMovement } from "../../../../queries/inventory/types";
import { EmptyList } from "../../../admin/states";

const FROM_MD = "hidden md:table-cell";

/** Newest first. Each row's balance is what was on hand right after it. */
export function MovementsTable({ movements, unit }: { movements: StockMovement[]; unit: string }) {
  if (movements.length === 0)
    return (
      <EmptyList
        icon={HistoryIcon}
        title="No movements yet"
        description="Deliveries, sales, returns, counts and adjustments of this product appear here as they happen."
      />
    );
  const columns: DataTableColumn<StockMovement>[] = [
    {
      id: "when",
      header: "When",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => shiftTime(row.original.occurredAt),
    },
    {
      id: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <Badge variant={row.original.reason === "receipt" ? "default" : "secondary"}>
          {REASON_LABELS[row.original.reason] ?? row.original.reason}
        </Badge>
      ),
    },
    {
      id: "change",
      header: "Change",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {changeLabel(row.original.quantityThousandths, unit)}
        </span>
      ),
    },
    {
      id: "balance",
      header: "Balance",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">{quantityLabel(row.original.balanceThousandths, unit)}</span>
      ),
    },
    {
      id: "cost",
      header: "Unit cost",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) =>
        row.original.unitCost === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Money amount={money(row.original.unitCost)} />
        ),
    },
  ];
  return (
    <DataTable
      label="Stock movements"
      columns={columns}
      data={movements}
      getRowId={(movement) => movement.id}
      className="min-h-0"
    />
  );
}
