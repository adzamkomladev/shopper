import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RangeBar } from "../../../components/register/range";
import { ReportSection } from "../../../components/register/report/section";
import { ReportBodySkeleton, ReportSkeleton } from "../../../components/register/report/skeleton";
import { ReportSummary } from "../../../components/register/report/summary";
import { HoursList, ProductsTable, TendersTable } from "../../../components/register/report/tables";
import { Gate, LoadError, OfflineNote } from "../../../components/register/states";
import { rangeError, today } from "../../../lib/register/range";
import { reportQuery } from "../../../queries/register/report";

/** Sales Reports: the register's sales for a day range by payment method, hour and product. */
export function RegisterReports({ online = true }: { online?: boolean }) {
  return (
    <Gate fallback={<ReportSkeleton />} need="report.read" what="sales reports">
      <Reports online={online} />
    </Gate>
  );
}

function Reports({ online }: { online: boolean }) {
  // ponytail: "today" is read once, so a register left open past midnight needs a new range picked.
  const [range, setRange] = useState(today);
  const report = useQuery(reportQuery(range));
  const { data } = report;
  const hours = data?.byHour.filter((hour) => hour.count > 0) ?? [];
  return (
    <div className="flex flex-col gap-6 pb-6">
      {!online && (
        <OfflineNote>
          This is the sales rung up on this register. They reach the server when it reconnects.
        </OfflineNote>
      )}
      <RangeBar onChange={setRange} range={range} />
      {rangeError(range) ? null : report.isError && !data ? (
        <LoadError error={report.error} onRetry={() => void report.refetch()} what="the report" />
      ) : report.isPending ? (
        <ReportBodySkeleton />
      ) : (
        data && (
          <div
            aria-busy={report.isPlaceholderData}
            className={`flex flex-col gap-6 ${report.isPlaceholderData ? "opacity-60" : ""}`}
          >
            <ReportSummary report={data} />
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <ReportSection
                empty={data.tenders.length ? null : "No payments on these days."}
                title="By payment method"
              >
                <TendersTable tenders={data.tenders} />
              </ReportSection>
              <ReportSection
                empty={hours.length ? null : "No sales on these days yet."}
                title="Sales by hour"
              >
                <HoursList hours={hours} />
              </ReportSection>
            </div>
            <ReportSection
              empty={data.topProducts.length ? null : "No products sold on these days."}
              title="Top products"
            >
              <ProductsTable products={data.topProducts} />
            </ReportSection>
          </div>
        )
      )}
    </div>
  );
}
