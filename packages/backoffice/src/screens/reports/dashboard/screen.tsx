import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DaySide } from "../../../components/reports/dashboard/side";
import { HourBars } from "../../../components/reports/dashboard/hours";
import { KpiTiles } from "../../../components/reports/dashboard/tiles";
import { ReportsPage } from "../../../components/reports/page";
import { ReportSkeleton } from "../../../components/reports/states";
import { ReportToolbar } from "../../../components/reports/toolbar";
import { stepDay } from "../../../lib/reports/range";
import { shopToday } from "../../../lib/tax/dates";
import { reportQuery } from "../../../queries/reports/reports";

/** One shop day at a glance against the day before: six figures, best sellers, tender mix and sales by hour. */
export function ReportsDashboardScreen() {
  return (
    <ReportsPage active="dashboard">
      <DashboardBody />
    </ReportsPage>
  );
}

function DashboardBody() {
  const search = useSearch({ from: "/_shop/reports" });
  const navigate = useNavigate();
  const params = { day: search.day ?? shopToday(), branchId: search.branchId };
  const go = (change: Partial<typeof params>) =>
    void navigate({ to: "/reports", search: { ...search, ...change }, replace: true });
  return (
    <>
      <ReportToolbar
        period={{
          kind: "day",
          day: params.day,
          onDay: (day) => go({ day }),
          onStep: (direction) => go({ day: stepDay(params.day, direction) }),
        }}
        branchId={params.branchId}
        onBranch={(branchId) => go({ branchId })}
        exporting={{ kind: "dashboard", params }}
      />
      <Suspense fallback={<ReportSkeleton label="Loading the dashboard" tiles toolbar={false} />}>
        <DashboardFigures params={params} />
      </Suspense>
    </>
  );
}

function DashboardFigures({ params }: { params: { day: string; branchId?: string } }) {
  const { data } = useSuspenseQuery(reportQuery("dashboard", params));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <KpiTiles kpis={data.kpis} />
        <HourBars hours={data.hours} />
      </div>
      <DaySide top={data.top} tenders={data.tenders} />
    </div>
  );
}
