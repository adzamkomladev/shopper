import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { shiftTime } from "../../../lib/shifts/format";
import type { ReconciliationView } from "../../../schemas/reconciliation";
import { VarianceBadge } from "../../shifts/list/badge";

const KINDS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["momo", "MoMo"],
] as const;

/** The day's closed shifts with each tender's variance; a shift opens its Z report. */
export function ShiftVariances({ shifts }: { shifts: ReconciliationView["shifts"] }) {
  return (
    <section aria-labelledby="shifts-heading" className="flex flex-col gap-4">
      <h2 id="shifts-heading" className="text-lg font-semibold tracking-tight">
        By shift
      </h2>
      {shifts.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No shift was closed on this day, so nothing was declared yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table aria-label="By shift">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-4">Closed</TableHead>
                  {KINDS.map(([kind, label]) => (
                    <TableHead key={kind} className={kind === "cash" ? "" : "hidden sm:table-cell"}>
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id} className="h-14 hover:bg-transparent">
                    <TableCell className="px-4">
                      <Link
                        to="/shifts/$shiftId"
                        params={{ shiftId: shift.id }}
                        className="font-medium hover:underline"
                      >
                        {shiftTime(shift.closedAt)}
                      </Link>
                    </TableCell>
                    {KINDS.map(([kind]) => {
                      const variance =
                        shift.tenders.find((row) => row.tender === kind)?.variance ?? 0;
                      return (
                        <TableCell
                          key={kind}
                          className={kind === "cash" ? "" : "hidden sm:table-cell"}
                        >
                          <VarianceBadge
                            short={Math.min(variance, 0)}
                            over={Math.max(variance, 0)}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
