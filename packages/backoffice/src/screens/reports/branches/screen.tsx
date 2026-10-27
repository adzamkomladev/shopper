import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BranchesTable } from "../../../components/reports/branches/table";
import { ReportsPage } from "../../../components/reports/page";
import { NothingToReport, ReportSkeleton } from "../../../components/reports/states";
import { ReportToolbar } from "../../../components/reports/toolbar";
import { rangeOf, rangePeriod } from "../../../lib/reports/range";
import { reportQuery } from "../../../queries/reports/reports";

type Params = { from: string; to: string };

/** Every branch side by side over a range of shop days. */
export function BranchComparisonScreen() {
  return (
    <ReportsPage active="branches">
      <BranchesBody />
    </ReportsPage>
  );
}

function BranchesBody() {
  const search = useSearch({ from: "/_shop/reports/branches" });
  const navigate = useNavigate();
  const params: Params = rangeOf(search);
  const go = (change: Partial<Params>) =>
    void navigate({ to: "/reports/branches", search: { ...search, ...change }, replace: true });
  return (
    <>
      <ReportToolbar period={rangePeriod(params, go)} exporting={{ kind: "branches", params }} />
      <Suspense fallback={<ReportSkeleton label="Loading the branch comparison" toolbar={false} />}>
        <BranchesFigures params={params} />
      </Suspense>
    </>
  );
}

function BranchesFigures({ params }: { params: Params }) {
  const { data } = useSuspenseQuery(reportQuery("branches", params));
  if (data.total.transactions === 0 && data.total.refundGross === 0)
    return (
      <NothingToReport title={`No branch sold anything from ${params.from} to ${params.to}`}>
        Pick another range. Branches show here once their tills have sent sales.
      </NothingToReport>
    );
  return <BranchesTable report={data} />;
}
