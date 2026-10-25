"use no memo";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { FISCAL_KIND, FISCAL_STATUS, fiscalTime } from "../../../lib/tax/fiscal";
import type { FiscalRow } from "../../../schemas/tax/fiscal";

// A phone keeps the receipt and where it stands; a tablet adds the branch; a laptop the time and tries.
export const FROM_MD = "hidden md:table-cell";
export const FROM_LG = "hidden lg:table-cell";
export const rowButtonId = (id: string) => `fiscal-${id}`;

type Props = { rows: FiscalRow[]; onOpen: (row: FiscalRow, trigger: string) => void };

export function FiscalTable({ rows, onOpen }: Props) {
  const columns: DataTableColumn<FiscalRow>[] = [
    {
      id: "receipt",
      header: "Receipt",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col items-start">
          <Button
            id={rowButtonId(row.original.id)}
            variant="link"
            className="h-auto p-0 font-medium"
            onClick={() => onOpen(row.original, rowButtonId(row.original.id))}
          >
            {row.original.invoiceNumber}
          </Button>
          <span className="text-xs text-muted-foreground">{FISCAL_KIND[row.original.kind]}</span>
        </div>
      ),
    },
    {
      id: "branch",
      header: "Branch",
      meta: { className: FROM_MD },
      cell: ({ row }) => row.original.branchName,
    },
    {
      id: "issued",
      header: "Issued",
      meta: { className: `${FROM_LG} tabular-nums` },
      cell: ({ row }) => fiscalTime(row.original.createdAt),
    },
    {
      id: "tries",
      header: "Tries",
      meta: { align: "right", className: `${FROM_LG} tabular-nums` },
      cell: ({ row }) => row.original.attempts,
    },
    {
      id: "status",
      header: "Status",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => {
        const status = FISCAL_STATUS[row.original.status];
        return (
          <div className="flex max-w-xs flex-col items-start gap-1">
            <Badge variant={status.variant}>{status.label}</Badge>
            {row.original.reason && (
              <span className="text-xs text-muted-foreground">{row.original.reason}</span>
            )}
          </div>
        );
      },
    },
  ];
  return (
    <DataTable
      label="Fiscal documents"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      className="min-h-0"
    />
  );
}
