import { Badge } from "@shopper/ui/components/badge";
import type { JournalView } from "../../../schemas/reports/views";
import { cash, cedis, ReportTable } from "../table";
import type { ReportColumn } from "../types";

type Row = JournalView["rows"][number];

/** The accountant's journal: one balanced entry per day and branch, debits beside credits, the totals last. */
export function JournalTable({ report }: { report: JournalView }) {
  const balanced = report.total.debit === report.total.credit;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={balanced ? "secondary" : "destructive"}>
          {balanced ? "Balanced" : "Out of balance"}
        </Badge>
        Debits {cedis(report.total.debit)} · Credits {cedis(report.total.credit)}
      </p>
      <ReportTable
        label="Journal"
        columns={columns}
        rows={report.rows}
        total={{ day: "", branchId: "", branch: "", account: "Total", ...report.total }}
        rowId={(row) => `${row.day}|${row.branchId}|${row.account}`}
      />
    </div>
  );
}

const columns: ReportColumn<Row>[] = [
  {
    id: "entry",
    header: "Entry",
    cell: (row) => (
      <span className="flex flex-col">
        <span>{row.account}</span>
        {row.day && (
          <span className="text-xs font-normal text-muted-foreground">
            {row.day} · {row.branch}
          </span>
        )}
      </span>
    ),
  },
  // A phone has room for one figure: the side it is on, then the amount.
  {
    id: "amount",
    header: "Dr / Cr",
    figure: true,
    phone: true,
    cell: (row) =>
      row.account === "Total"
        ? cash(row.debit)
        : `${row.debit ? "Dr" : "Cr"} ${cedis(row.debit || row.credit)}`,
  },
  {
    id: "debit",
    header: "Debit",
    figure: true,
    from: "sm",
    cell: (row) => (row.debit ? cash(row.debit) : ""),
  },
  {
    id: "credit",
    header: "Credit",
    figure: true,
    from: "sm",
    cell: (row) => (row.credit ? cash(row.credit) : ""),
  },
];
