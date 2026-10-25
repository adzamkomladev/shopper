"use no memo";
import { BadgeCheckIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { auditTime, commandLabel } from "../../../lib/audit/diff";
import type { AuditItem } from "../../../schemas/audit";

// A phone keeps the action, who and when; a tablet adds where; a laptop the approver.
const FROM_MD = "hidden md:table-cell";
const FROM_LG = "hidden lg:table-cell";
export const entryButtonId = (id: string) => `audit-${id}`;

type Props = {
  rows: AuditItem[];
  onOpen: (row: AuditItem, trigger: string) => void;
  onEndReached: () => void;
};

export function AuditTable({ rows, onOpen, onEndReached }: Props) {
  const columns: DataTableColumn<AuditItem>[] = [
    {
      id: "action",
      header: "Action",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col items-start">
          <Button
            id={entryButtonId(row.original.id)}
            variant="link"
            className="h-auto p-0 text-left font-medium whitespace-normal"
            onClick={() => onOpen(row.original, entryButtonId(row.original.id))}
          >
            {commandLabel(row.original.command)}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {auditTime(row.original.at)}
          </span>
        </div>
      ),
    },
    {
      id: "who",
      header: "Who",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.actor?.name ?? "System"}</span>
          {row.original.role && (
            <span className="text-xs text-muted-foreground">{row.original.role}</span>
          )}
        </div>
      ),
    },
    {
      id: "where",
      header: "Where",
      meta: { className: `${FROM_MD} whitespace-normal` },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.device?.name ?? "Back office"}</span>
          {row.original.branch?.name && (
            <span className="text-xs text-muted-foreground">{row.original.branch.name}</span>
          )}
        </div>
      ),
    },
    {
      id: "approver",
      header: "Approved by",
      meta: { className: FROM_LG },
      cell: ({ row }) =>
        row.original.approver ? (
          <Badge variant="secondary">
            <BadgeCheckIcon aria-hidden />
            {row.original.approver.name ?? "A manager"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];
  return (
    <DataTable
      label="Audit entries"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      onEndReached={onEndReached}
      // Eight filters stack on a phone: the table keeps a usable height and the page scrolls to it.
      className="min-h-96"
    />
  );
}
