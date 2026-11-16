import { HistoryIcon } from "lucide-react";
import { EmptyList, shiftTime } from "@shopper/backoffice/kit";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import type { TenantDetail } from "../../../schemas/types";

type Row = TenantDetail["activity"][number];

const columns: DataTableColumn<Row>[] = [
  {
    id: "what",
    header: "What",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-mono text-xs">{row.original.command}</span>
        {row.original.reason && (
          <span className="text-xs text-muted-foreground">{row.original.reason}</span>
        )}
      </div>
    ),
  },
  {
    id: "who",
    header: "Who",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.actor ?? "System"}</span>
        {row.original.role && (
          <span className="text-xs text-muted-foreground">{row.original.role}</span>
        )}
      </div>
    ),
  },
  {
    id: "entity",
    header: "On",
    meta: { className: "hidden lg:table-cell" },
    cell: ({ row }) => row.original.entity ?? "—",
  },
  { id: "when", header: "When", cell: ({ row }) => shiftTime(row.original.at) },
];

/** The newest audit rows, newest first. */
export function TenantActivity({ activity }: { activity: Row[] }) {
  if (!activity.length)
    return (
      <EmptyList
        icon={HistoryIcon}
        title="No activity yet"
        description="Nothing has been audited for this shop."
      />
    );
  return (
    <>
      <p className="text-sm text-muted-foreground">The newest {activity.length} audit rows.</p>
      <DataTable label="Activity" columns={columns} data={activity} getRowId={(row) => row.id} />
    </>
  );
}
