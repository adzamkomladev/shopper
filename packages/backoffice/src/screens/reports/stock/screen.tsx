import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Label } from "@shopper/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@shopper/ui/components/radio-group";
import { ReportsPage } from "../../../components/reports/page";
import { DeadStockTable } from "../../../components/reports/stock/table";
import { NothingToReport, ReportSkeleton } from "../../../components/reports/states";
import { ReportToolbar } from "../../../components/reports/toolbar";
import { stepDay } from "../../../lib/reports/range";
import { shopToday } from "../../../lib/tax/dates";
import { reportQuery } from "../../../queries/reports/reports";

const WINDOWS = [30, 60, 90] as const;
type Params = { on: string; days: string; branchId?: string };

/** Products on hand that have not sold in 30, 60 or 90 days up to a shop day, and what they tie up. */
export function DeadStockScreen() {
  return (
    <ReportsPage active="stock">
      <DeadStockBody />
    </ReportsPage>
  );
}

function DeadStockBody() {
  const search = useSearch({ from: "/_shop/reports/stock/dead" });
  const navigate = useNavigate();
  const params: Params = {
    on: search.day ?? shopToday(),
    days: `${search.days ?? 30}`,
    branchId: search.branchId,
  };
  const go = (change: { day?: string; days?: (typeof WINDOWS)[number]; branchId?: string }) =>
    void navigate({ to: "/reports/stock/dead", search: { ...search, ...change }, replace: true });
  return (
    <>
      <ReportToolbar
        period={{
          kind: "day",
          day: params.on,
          onDay: (day) => go({ day }),
          onStep: (direction) => go({ day: stepDay(params.on, direction) }),
        }}
        branchId={params.branchId}
        onBranch={(branchId) => go({ branchId })}
        exporting={{ kind: "stock/dead", params }}
        controls={
          <div className="flex flex-col gap-2">
            <Label id="dead-days">Not sold in</Label>
            <RadioGroup
              aria-labelledby="dead-days"
              value={params.days}
              onValueChange={(days) => go({ days: Number(days) as (typeof WINDOWS)[number] })}
              className="flex h-9 items-center gap-4"
            >
              {WINDOWS.map((days) => (
                <div key={days} className="flex items-center gap-2">
                  <RadioGroupItem id={`dead-days-${days}`} value={String(days)} />
                  <Label htmlFor={`dead-days-${days}`} className="font-normal">
                    {days} days
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        }
      />
      <Suspense fallback={<ReportSkeleton label="Loading dead stock" toolbar={false} />}>
        <DeadStockFigures params={params} />
      </Suspense>
    </>
  );
}

function DeadStockFigures({ params }: { params: Params }) {
  const { data } = useSuspenseQuery(reportQuery("stock/dead", params));
  if (data.rows.length === 0)
    return (
      <NothingToReport title={`Everything on hand sold in the ${params.days} days to ${params.on}`}>
        No stock is sitting unsold. Try a shorter window to see slow movers.
      </NothingToReport>
    );
  return <DeadStockTable report={data} />;
}
