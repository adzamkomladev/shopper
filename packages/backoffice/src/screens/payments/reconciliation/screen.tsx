import { Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { MomoSettlement } from "../../../components/payments/reconciliation/momo";
import { ShiftVariances } from "../../../components/payments/reconciliation/shifts";
import { ReconciliationBodySkeleton } from "../../../components/payments/reconciliation/states";
import { TenderTable } from "../../../components/payments/reconciliation/tenders";
import { PeriodControls } from "../../../components/reports/period";
import { PaymentsPage } from "../../../components/payments/page";
import { Gate, OfflineNote } from "../../../components/register/states";
import { stepDay } from "../../../lib/reports/range";
import { shopToday } from "../../../lib/tax/dates";
import {
  reconciliationQuery,
  useRefreshSettlement,
} from "../../../queries/payments/reconciliation";
import { usePermissions } from "../../../queries/session/permissions";

/** One trading day's money: each tender taken, declared and settled, MoMo against Paystack, and each shift. */
export function ReconciliationScreen() {
  const search = useSearch({ from: "/_shop/payments/reconciliation" });
  const navigate = useNavigate({ from: "/payments/reconciliation" });
  const online = useOnline();
  const refresh = useRefreshSettlement();
  const canRefresh = usePermissions()?.includes("payment.reconcile") && online;
  const day = search.day ?? shopToday();
  const go = (next: string) => navigate({ search: { day: next }, replace: true });
  const refreshNow = () => canRefresh && !refresh.isPending && refresh.mutate(day);
  const shortcuts = useShortcuts({
    "[": () => go(stepDay(day, -1)),
    "]": () => go(stepDay(day, 1)),
    ...(canRefresh && { R: refreshNow }),
  });
  return (
    <PaymentsPage
      active="reconciliation"
      action={
        canRefresh && (
          <Button
            variant="outline"
            onClick={refreshNow}
            disabled={refresh.isPending}
            aria-keyshortcuts="R"
          >
            <RefreshCwIcon aria-hidden />
            {refresh.isPending ? "Starting…" : "Refresh settlement"}
            <Kbd aria-hidden>R</Kbd>
          </Button>
        )
      }
    >
      <Gate need="report.read" what="the reconciliation" fallback={<ReconciliationBodySkeleton />}>
        <div ref={shortcuts} className="flex flex-col gap-6">
          {!online && (
            <OfflineNote>
              You're seeing figures loaded earlier. Other days need a connection.
            </OfflineNote>
          )}
          <PeriodControls
            period={{
              kind: "day",
              day,
              onDay: go,
              onStep: (direction) => go(stepDay(day, direction)),
            }}
          />
          <Suspense fallback={<ReconciliationBodySkeleton />}>
            <Day day={day} />
          </Suspense>
        </div>
      </Gate>
    </PaymentsPage>
  );
}

function Day({ day }: { day: string }) {
  const { data } = useSuspenseQuery(reconciliationQuery(day));
  return (
    <>
      <TenderTable tenders={data.tenders} />
      <MomoSettlement momo={data.momo} />
      <ShiftVariances shifts={data.shifts} />
    </>
  );
}
