import { Suspense, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { BranchPicker } from "../../../components/inventory/picker";
import { NoBranch } from "../../../components/inventory/stock/list/states";
import { InventoryPage } from "../../../components/inventory/tabs";
import { ValuationSummary } from "../../../components/inventory/valuation/summary";
import {
  NothingToValue,
  ValuationBodySkeleton,
  ValuationResultsSkeleton,
} from "../../../components/inventory/valuation/states";
import { ValuationTable } from "../../../components/inventory/valuation/table";
import { Gate, OfflineNote } from "../../../components/register/states";
import { pickBranch } from "../../../lib/inventory/format";
import { stockBranchesQuery } from "../../../queries/inventory/stock";
import { valuationQuery } from "../../../queries/inventory/valuation";
import { usePermissions } from "../../../queries/session/permissions";

/** What the stock at one branch is worth at the last unit cost, with the total and what needs a look. */
export function ValuationScreen() {
  return (
    <InventoryPage active="valuation">
      <Gate need="stock.read" what="the stock valuation" fallback={<ValuationBodySkeleton />}>
        <ValuationBody />
      </Gate>
    </InventoryPage>
  );
}

function ValuationBody() {
  const search = useSearch({ from: "/_shop/stock/valuation" });
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(stockBranchesQuery());
  const online = useOnline();
  const [branchOpen, setBranchOpen] = useState(false);
  const shortcuts = useShortcuts({ B: () => setBranchOpen(true) });
  const branch = pickBranch(data.branches, search.branch);
  if (!branch) return <NoBranch />;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing the valuation loaded earlier. Current values appear when you're back online.
        </OfflineNote>
      )}
      <BranchPicker
        branches={data.branches}
        branchId={branch.id}
        onBranchChange={(id) =>
          void navigate({ to: "/stock/valuation", search: { branch: id }, replace: true })
        }
        open={branchOpen}
        onOpenChange={setBranchOpen}
      />
      <Suspense fallback={<ValuationResultsSkeleton />}>
        <ValuationResults branchId={branch.id} branchName={branch.name} />
      </Suspense>
    </div>
  );
}

function ValuationResults({ branchId, branchName }: { branchId: string; branchName: string }) {
  const canWrite = !!usePermissions()?.includes("stock.write");
  const { data } = useSuspenseQuery(valuationQuery(branchId));
  return (
    <>
      <ValuationSummary valuation={data} />
      {data.lines.length === 0 ? (
        <NothingToValue branchId={branchId} branchName={branchName} canWrite={canWrite} />
      ) : (
        <ValuationTable lines={data.lines} />
      )}
    </>
  );
}
