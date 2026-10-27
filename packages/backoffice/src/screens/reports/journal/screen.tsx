import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { JournalTable } from "../../../components/reports/journal/table";
import { ReportsPage } from "../../../components/reports/page";
import { NothingToReport, ReportSkeleton } from "../../../components/reports/states";
import { ReportToolbar } from "../../../components/reports/toolbar";
import { rangeOf, rangePeriod } from "../../../lib/reports/range";
import { reportQuery } from "../../../queries/reports/reports";

type Params = { from: string; to: string; branchId?: string };

/** The accountant's journal over a range of shop days: one balanced entry per day and branch. */
export function JournalScreen() {
  return (
    <ReportsPage active="journal">
      <JournalBody />
    </ReportsPage>
  );
}

function JournalBody() {
  const search = useSearch({ from: "/_shop/reports/journal" });
  const navigate = useNavigate();
  const params: Params = { ...rangeOf(search), branchId: search.branchId };
  const go = (change: Partial<Params>) =>
    void navigate({ to: "/reports/journal", search: { ...search, ...change }, replace: true });
  return (
    <>
      <ReportToolbar
        period={rangePeriod(params, go)}
        branchId={params.branchId}
        onBranch={(branchId) => go({ branchId })}
        exporting={{ kind: "journal", params }}
      />
      <Suspense fallback={<ReportSkeleton label="Loading the journal" toolbar={false} />}>
        <JournalFigures params={params} />
      </Suspense>
    </>
  );
}

function JournalFigures({ params }: { params: Params }) {
  const { data } = useSuspenseQuery(reportQuery("journal", params));
  if (data.rows.length === 0)
    return (
      <NothingToReport title={`Nothing to post from ${params.from} to ${params.to}`}>
        Pick another range or branch. Entries show here once the tills have sent sales.
      </NothingToReport>
    );
  return <JournalTable report={data} />;
}
