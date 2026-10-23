import { money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { bpsToPercent } from "../../../../lib/rate";
import type { TierView } from "../../../../schemas/settings/loyalty";

export const editTierId = (id: string) => `edit-tier-${id}`;
export const archiveTierId = (id: string) => `archive-tier-${id}`;

type Props = {
  tiers: TierView[];
  onEdit: (tier: TierView) => void;
  onArchive: (tier: TierView) => void;
};

/** The tiers, lowest threshold first, with the rate each one earns at. */
export function TierTable({ tiers, onEdit, onArchive }: Props) {
  const columns: DataTableColumn<TierView>[] = [
    {
      id: "name",
      header: "Tier",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "minSpend",
      header: "Spend over a year",
      meta: { align: "right" },
      cell: ({ row }) => <Money amount={money(row.original.minSpend)} />,
    },
    {
      id: "rate",
      header: "Earn rate",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">{bpsToPercent(row.original.earnBps)}%</span>
      ),
    },
  ];
  columns.push({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <Button
          id={editTierId(row.original.id)}
          variant="outline"
          size="sm"
          aria-label={`Edit ${row.original.name}`}
          onClick={() => onEdit(row.original)}
        >
          Edit
        </Button>
        <Button
          id={archiveTierId(row.original.id)}
          variant="outline"
          size="sm"
          aria-label={`Archive ${row.original.name}`}
          onClick={() => onArchive(row.original)}
        >
          Archive
        </Button>
      </div>
    ),
  });
  return (
    <DataTable
      label="Tiers"
      columns={columns}
      data={tiers}
      getRowId={(tier) => tier.id}
      className="min-h-0"
    />
  );
}
