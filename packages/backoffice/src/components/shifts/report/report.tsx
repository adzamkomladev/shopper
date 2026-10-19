import type { XReport, ZReport } from "@shopper/core/schemas";
import { anchorGroups, shiftTime } from "../../../lib/shifts/format";
import { ReportSection } from "../../register/report/section";
import { CashBox, CountedCash } from "./cash";
import { Cashiers, Movements } from "./movements";
import { ShiftTiles } from "./tiles";
import { TendersTable } from "./tenders";

/**
 * A shift's X or Z report, data in and nothing fetched: the till shows it at the register and the portal
 * shows a closed shift's stored Z. `approverName` names the manager on a Z that needed one.
 */
export function ShiftReport({
  report,
  approverName = null,
}: {
  report: XReport | ZReport;
  approverName?: string | null;
}) {
  const z = report.kind === "z";
  const names = new Map<string, string | null>(report.cashiers.map((c) => [c.userId, c.name]));
  return (
    <section aria-label={z ? "Z report" : "X report"} className="flex min-w-0 flex-col gap-6">
      <header className="grid gap-1">
        <h2 className="text-xl font-bold tracking-tight">{z ? "Z report" : "X report"}</h2>
        <p className="text-sm text-muted-foreground">
          {[
            report.registerName,
            z
              ? `Opened ${shiftTime(report.openedAt)}, closed ${shiftTime(report.closedAt)}`
              : `Read ${shiftTime(report.at)}. Not a close: nothing was changed.`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      <ShiftTiles report={report} />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ReportSection empty={null} title="Tenders">
          <TendersTable report={report} />
        </ReportSection>
        <ReportSection empty={null} title="Cash in the drawer">
          <CashBox cash={report.cash} />
        </ReportSection>
        {z && (
          <ReportSection empty={null} title="Counted cash">
            <CountedCash declared={report.declared} />
          </ReportSection>
        )}
        <ReportSection
          empty={report.movements.length === 0 ? "No drops or no-sales" : null}
          title="Drops and no-sales"
        >
          <Movements movements={report.movements} names={names} />
        </ReportSection>
        <ReportSection empty={null} title="Cashiers">
          <Cashiers
            approver={z && report.approverId ? (approverName ?? "a manager") : null}
            cashiers={report.cashiers}
          />
        </ReportSection>
        {z && (
          <ReportSection empty={null} title="Audit anchor">
            <div className="grid gap-1 p-4 text-sm">
              <p className="font-medium">#{report.anchor.seq}</p>
              <code className="font-mono text-xs break-words text-muted-foreground">
                {anchorGroups(report.anchor.hash)}
              </code>
            </div>
          </ReportSection>
        )}
      </div>
    </section>
  );
}
