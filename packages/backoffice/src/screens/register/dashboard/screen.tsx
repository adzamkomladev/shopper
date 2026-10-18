import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DashboardSkeleton,
  TilesSkeleton,
  dashboardGrid,
  tilesGrid,
} from "../../../components/register/dashboard/skeleton";
import { QuickActions } from "../../../components/register/dashboard/actions";
import type { DashboardTarget } from "../../../components/register/dashboard/types";
import { DashboardTiles } from "../../../components/register/dashboard/tiles";
import { RangeBar } from "../../../components/register/range";
import { Gate, LoadError, OfflineNote } from "../../../components/register/states";
import type { PermissionCode } from "../../../lib/roles/permissions";
import { rangeError, today } from "../../../lib/register/range";
import { reportQuery } from "../../../queries/register/report";
import { usePermissions } from "../../../queries/session/permissions";

// Which tab each quick action opens, and the permission that tab needs.
const needs: Record<DashboardTarget, PermissionCode> = {
  sale: "sale.create",
  inventory: "stock.read",
  reports: "report.read",
};

/** Figma "Dashboard": this register's totals for a day range, and shortcuts to the other tabs. */
export function RegisterDashboard({
  online = true,
  onOpen,
}: {
  online?: boolean;
  onOpen: (target: DashboardTarget) => void;
}) {
  return (
    <Gate fallback={<DashboardSkeleton />} need="report.read" what="the dashboard">
      <Dashboard online={online} onOpen={onOpen} />
    </Gate>
  );
}

function Dashboard({ online, onOpen }: { online: boolean; onOpen: (t: DashboardTarget) => void }) {
  // ponytail: "today" is read once, so a register left open past midnight needs a new range picked.
  const [range, setRange] = useState(today);
  const report = useQuery(reportQuery(range));
  const held = usePermissions() ?? [];
  const shown = (Object.keys(needs) as DashboardTarget[]).filter((t) => held.includes(needs[t]));
  const { data } = report;
  return (
    <div className="flex flex-col gap-6 pb-6">
      {!online && (
        <OfflineNote>
          These figures are this register's own sales. They reach the server when it reconnects.
        </OfflineNote>
      )}
      <RangeBar onChange={setRange} range={range} />
      <div className={dashboardGrid}>
        <div className="flex flex-col gap-5">
          {rangeError(range) ? null : report.isError && !data ? (
            <LoadError
              error={report.error}
              onRetry={() => void report.refetch()}
              what="the dashboard"
            />
          ) : report.isPending ? (
            <TilesSkeleton />
          ) : (
            <>
              {data?.totals.transactions === 0 && (
                <p
                  className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground"
                  role="status"
                >
                  No sales on these days yet. Sales rung up on this register appear here.
                </p>
              )}
              <div
                aria-busy={report.isPlaceholderData}
                className={report.isPlaceholderData ? `${tilesGrid} opacity-60` : tilesGrid}
              >
                {data && <DashboardTiles report={data} />}
              </div>
            </>
          )}
        </div>
        <QuickActions onOpen={onOpen} shown={shown} />
      </div>
    </div>
  );
}
