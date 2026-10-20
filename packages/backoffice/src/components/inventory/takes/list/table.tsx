import { Link } from "@tanstack/react-router";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { scopeLabel } from "../../../../lib/inventory/takes";
import { compactTime } from "../../../../lib/inventory/format";
import { shiftTime } from "../../../../lib/shifts/format";
import type { TakeSummary } from "../../../../queries/inventory/types";
import { TakeStatus } from "../status";

const FROM_MD = "hidden md:table-cell";
const FROM_LG = "hidden lg:table-cell";

const Dash = () => <span className="text-muted-foreground">—</span>;
/** How much of the sheet is counted, like "12 of 40". */
export const counted = ({ lines, uncounted }: Pick<TakeSummary, "lines" | "uncounted">) =>
  `${lines - uncounted} of ${lines}`;

const columns: DataTableColumn<TakeSummary>[] = [
  {
    id: "started",
    header: "Started",
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-1">
        <Link
          to="/stock/takes/$takeId"
          params={{ takeId: row.original.id }}
          className="font-medium hover:underline"
        >
          <span className="md:hidden">{compactTime(row.original.startedAt)}</span>
          <span className="hidden md:inline">{shiftTime(row.original.startedAt)}</span>
        </Link>
        {/* A phone has no Status column: the status sits under the date. */}
        <span className="md:hidden">
          <TakeStatus status={row.original.status} />
        </span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    meta: { className: FROM_MD },
    cell: ({ row }) => <TakeStatus status={row.original.status} />,
  },
  {
    id: "covers",
    header: "Covers",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => <span className="wrap-break-word">{scopeLabel(row.original)}</span>,
  },
  {
    id: "counted",
    header: "Counted",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{counted(row.original)}</span>,
  },
  {
    id: "by",
    header: "Started by",
    meta: { className: FROM_LG },
    cell: ({ row }) => row.original.startedByName,
  },
  {
    id: "closed",
    header: "Closed",
    meta: { className: FROM_LG },
    cell: ({ row }) => (row.original.closedAt ? shiftTime(row.original.closedAt) : <Dash />),
  },
];

type Props = { takes: TakeSummary[]; onEndReached: () => void };

export function TakesTable({ takes, onEndReached }: Props) {
  return (
    <DataTable
      label="Stock takes"
      columns={columns}
      data={takes}
      getRowId={(take) => take.id}
      onEndReached={onEndReached}
      className="min-h-0"
    />
  );
}
