import { Link } from "@tanstack/react-router";
import { money } from "@shopper/money";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { shiftTime } from "../../../lib/shifts/format";
import type { ShiftView } from "../../../queries/shifts/list";
import { VarianceBadge } from "./badge";
import { ChecksBadge } from "./checks";

// A phone keeps when it closed and how it came out; a tablet adds the cash; a laptop shows the rest.
export const FROM_MD = "hidden md:table-cell";
export const FROM_LG = "hidden lg:table-cell";

export function ShiftTable({ shifts }: { shifts: ShiftView[] }) {
  const columns: DataTableColumn<ShiftView>[] = [
    {
      id: "closed",
      header: "Closed",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            to="/shifts/$shiftId"
            params={{ shiftId: row.original.id }}
            className="w-fit font-medium text-balance hover:underline"
          >
            {shiftTime(row.original.closedAt)}
          </Link>
          <span className="text-xs text-muted-foreground lg:hidden">
            {row.original.deviceName} · {row.original.branchName}
          </span>
        </div>
      ),
    },
    { id: "register", header: "Register", meta: { className: FROM_LG }, cell: register },
    { id: "branch", header: "Branch", meta: { className: FROM_LG }, cell: branch },
    { id: "closedBy", header: "Closed by", meta: { className: FROM_LG }, cell: closedBy },
    { id: "approver", header: "Approved by", meta: { className: FROM_LG }, cell: approver },
    {
      id: "expected",
      header: "Expected cash",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) => <Money amount={money(row.original.expectedCash)} />,
    },
    {
      id: "declared",
      header: "Declared cash",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) => <Money amount={money(row.original.declaredCash)} />,
    },
    {
      id: "variance",
      header: "Variance",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          <VarianceBadge short={row.original.short} over={row.original.over} />
          <ChecksBadge checks={row.original.checks} />
        </div>
      ),
    },
  ];
  return (
    <DataTable
      label="Closed shifts"
      columns={columns}
      data={shifts}
      getRowId={(shift) => shift.id}
      className="min-h-0"
    />
  );
}

type Cell = { row: { original: ShiftView } };
const register = ({ row }: Cell) => row.original.deviceName;
const branch = ({ row }: Cell) => row.original.branchName;
const closedBy = ({ row }: Cell) => row.original.closedByName;
const approver = ({ row }: Cell) =>
  row.original.approverName ?? <span className="text-muted-foreground">Not needed</span>;
