import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ReportsPage } from "../../../components/reports/page";
import { ProductsReport } from "../../../components/reports/products/table";
import { NothingToReport, ReportSkeleton } from "../../../components/reports/states";
import { ReportToolbar } from "../../../components/reports/toolbar";
import { rangeOf, rangePeriod } from "../../../lib/reports/range";
import { reportQuery } from "../../../queries/reports/reports";

type Params = { from: string; to: string; branchId?: string };

/** Product performance and margin over a range of shop days. */
export function ProductsReportScreen() {
  return (
    <ReportsPage active="products">
      <ProductsBody />
    </ReportsPage>
  );
}

function ProductsBody() {
  const search = useSearch({ from: "/_shop/reports/products" });
  const navigate = useNavigate();
  const params: Params = { ...rangeOf(search), branchId: search.branchId };
  const go = (change: Partial<Params>) =>
    void navigate({ to: "/reports/products", search: { ...search, ...change }, replace: true });
  return (
    <>
      <ReportToolbar
        period={rangePeriod(params, go)}
        branchId={params.branchId}
        onBranch={(branchId) => go({ branchId })}
        exporting={{ kind: "products", params }}
      />
      <Suspense fallback={<ReportSkeleton label="Loading products" toolbar={false} />}>
        <ProductsFigures params={params} />
      </Suspense>
    </>
  );
}

function ProductsFigures({ params }: { params: Params }) {
  const { data } = useSuspenseQuery(reportQuery("products", params));
  if (data.rows.length === 0)
    return (
      <NothingToReport title={`No products sold from ${params.from} to ${params.to}`}>
        Pick another range or branch. Products show here once the tills have sent their sales.
      </NothingToReport>
    );
  return <ProductsReport report={data} />;
}
