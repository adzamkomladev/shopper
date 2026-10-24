import { Link } from "@tanstack/react-router";
import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { Money } from "@shopper/ui/components/money";
import { ID_LABELS } from "../../../lib/kyc/ids";
import { STATUS_LABELS } from "../../../lib/kyc/status";
import { shiftTime } from "../../../lib/shifts/format";
import type { KycCase } from "../../../schemas/kyc";

// A phone keeps who and where the check stands; a tablet adds what was asked for; a laptop shows the ID.
export const FROM_MD = "hidden md:table-cell";
export const FROM_LG = "hidden lg:table-cell";

/** What a case shows in the ID column: the type and its mask, or why there is none. */
export function idSummary(kase: Pick<KycCase, "idType" | "idMasked" | "status">) {
  if (kase.idType) return `${ID_LABELS[kase.idType]} · ${kase.idMasked}`;
  return kase.status === "otp_sent" || kase.status === "id_needed"
    ? "Not given yet"
    : "No ID provided";
}

export function CaseTable({ cases }: { cases: KycCase[] }) {
  const columns: DataTableColumn<KycCase>[] = [
    {
      id: "subject",
      header: "Phone",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            to="/kyc/$caseId"
            params={{ caseId: row.original.id }}
            className="w-fit font-medium hover:underline"
          >
            {row.original.phone}
          </Link>
          <span className="text-xs text-muted-foreground">
            {row.original.purpose === "credit" ? "Credit" : "Staff role"}
          </span>
        </div>
      ),
    },
    {
      id: "request",
      header: "Asked for",
      meta: { align: "right", className: FROM_MD },
      cell: ({ row }) =>
        row.original.requestedLimit ? (
          <Money amount={money(row.original.requestedLimit)} />
        ) : (
          <span className="block text-right text-muted-foreground">A role</span>
        ),
    },
    {
      id: "id",
      header: "ID",
      meta: { className: `${FROM_LG} whitespace-normal` },
      cell: ({ row }) => idSummary(row.original),
    },
    {
      id: "status",
      header: "Status",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant={row.original.status === "review" ? "secondary" : "outline"}>
            {STATUS_LABELS[row.original.status]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Opened {shiftTime(row.original.createdAt)}
          </span>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      label="Identity checks"
      columns={columns}
      data={cases}
      getRowId={(kase) => kase.id}
      className="min-h-0"
    />
  );
}
