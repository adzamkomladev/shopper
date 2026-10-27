import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Label } from "@shopper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { ReportsPage } from "../../../components/reports/page";
import { SalesTable } from "../../../components/reports/sales/table";
import { NothingToReport, ReportSkeleton } from "../../../components/reports/states";
import { ReportToolbar } from "../../../components/reports/toolbar";
import { rangeOf, rangePeriod } from "../../../lib/reports/range";
import { reportQuery } from "../../../queries/reports/reports";
import { salesGroupings } from "../../../schemas/reports/search";

const GROUPS = {
  day: "Day",
  hour: "Hour",
  branch: "Branch",
  cashier: "Cashier",
  tender: "Tender",
} as const;
type Params = { from: string; to: string; by: (typeof salesGroupings)[number]; branchId?: string };

/** Sales over a range of shop days, grouped by day, hour, branch, cashier or tender. */
export function SalesReportScreen() {
  return (
    <ReportsPage active="sales">
      <SalesBody />
    </ReportsPage>
  );
}

function SalesBody() {
  const search = useSearch({ from: "/_shop/reports/sales" });
  const navigate = useNavigate();
  const params: Params = { ...rangeOf(search), by: search.by ?? "day", branchId: search.branchId };
  const go = (change: Partial<Params>) =>
    void navigate({ to: "/reports/sales", search: { ...search, ...change }, replace: true });
  return (
    <>
      <ReportToolbar
        period={rangePeriod(params, go)}
        branchId={params.branchId}
        onBranch={(branchId) => go({ branchId })}
        exporting={{ kind: "sales", params }}
        controls={
          <div className="flex flex-col gap-2">
            <Label htmlFor="sales-by">Group by</Label>
            <Select value={params.by} onValueChange={(by) => go({ by: by as Params["by"] })}>
              <SelectTrigger id="sales-by" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {salesGroupings.map((by) => (
                  <SelectItem key={by} value={by}>
                    {GROUPS[by]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <Suspense fallback={<ReportSkeleton label="Loading sales" toolbar={false} />}>
        <SalesFigures params={params} />
      </Suspense>
    </>
  );
}

function SalesFigures({ params }: { params: Params }) {
  const { data } = useSuspenseQuery(reportQuery("sales", params));
  const quiet =
    data.by === "tender"
      ? data.rows.length === 0
      : data.total.transactions + data.total.refunds === 0;
  if (quiet)
    return (
      <NothingToReport title={`No sales from ${params.from} to ${params.to}`}>
        Pick another range or branch. Sales show here once the tills have sent them.
      </NothingToReport>
    );
  return <SalesTable report={data} />;
}
