import { Suspense, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { PageHeader } from "../../../../components/admin/page/header";
import { StockResults } from "../../../../components/inventory/stock/list/results";
import { NoBranch, TableSkeleton } from "../../../../components/inventory/stock/list/states";
import { StockToolbar } from "../../../../components/inventory/stock/list/toolbar";
import { Gate, OfflineNote } from "../../../../components/register/states";
import { useStockSearch } from "../../../../hooks/inventory/stock/search";
import { useStockShortcuts } from "../../../../hooks/inventory/stock/shortcuts";
import { pickBranch } from "../../../../lib/inventory/format";
import { stockBranchesQuery } from "../../../../queries/inventory/stock";

/** What is on hand at one branch, with search and the low stock filter; a row opens the product's page. */
export function StockScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader title="Stock" />
      <Gate need="stock.read" what="stock" fallback={<TableSkeleton />}>
        <StockBody />
      </Gate>
    </div>
  );
}

function StockBody() {
  const search = useSearch({ from: "/_shop/stock" });
  const { data } = useSuspenseQuery(stockBranchesQuery());
  const online = useOnline();
  const searchRef = useRef<HTMLInputElement>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const state = useStockSearch(search);
  const shortcuts = useStockShortcuts({
    focusSearch: () => searchRef.current?.focus(),
    toggleLow: state.toggleLow,
    pickBranch: () => setBranchOpen(true),
  });
  const branch = pickBranch(data.branches, search.branch);
  if (!branch) return <NoBranch />;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing the stock loaded earlier. Current counts appear when you're back online.
        </OfflineNote>
      )}
      <StockToolbar
        text={state.text}
        onTextChange={state.onTextChange}
        searchRef={searchRef}
        branches={data.branches}
        branchId={branch.id}
        onBranchChange={state.onBranchChange}
        branchOpen={branchOpen}
        onBranchOpenChange={setBranchOpen}
        low={!!search.low}
        onToggleLow={state.toggleLow}
      />
      <Suspense fallback={<TableSkeleton />}>
        <StockResults
          branchId={branch.id}
          branchName={branch.name}
          q={search.q}
          low={search.low}
          onClear={state.clear}
        />
      </Suspense>
    </div>
  );
}
