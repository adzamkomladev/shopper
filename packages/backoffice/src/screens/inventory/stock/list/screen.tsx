import { Suspense, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { InventoryPage } from "../../../../components/inventory/tabs";
import { StockResults } from "../../../../components/inventory/stock/list/results";
import {
  NoBranch,
  StockBodySkeleton,
  TableSkeleton,
} from "../../../../components/inventory/stock/list/states";
import { StockToolbar } from "../../../../components/inventory/stock/list/toolbar";
import { Gate, OfflineNote } from "../../../../components/register/states";
import { useStockSearch } from "../../../../hooks/inventory/stock/search";
import { useStockShortcuts } from "../../../../hooks/inventory/stock/shortcuts";
import { pickBranch } from "../../../../lib/inventory/format";
import { stockBranchesQuery } from "../../../../queries/inventory/stock";

/** What is on hand at one branch, with search and the low and negative stock filters; a row opens the product's page. */
export function StockScreen() {
  return (
    <InventoryPage active="stock">
      <Gate need="stock.read" what="stock" fallback={<StockBodySkeleton />}>
        <StockBody />
      </Gate>
    </InventoryPage>
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
    toggleNegative: state.toggleNegative,
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
        onSearchKeyDown={state.onSearchKeyDown}
        searchRef={searchRef}
        branches={data.branches}
        branchId={branch.id}
        onBranchChange={state.onBranchChange}
        branchOpen={branchOpen}
        onBranchOpenChange={setBranchOpen}
        low={!!search.low}
        onToggleLow={state.toggleLow}
        negative={!!search.negative}
        onToggleNegative={state.toggleNegative}
      />
      <Suspense fallback={<TableSkeleton />}>
        <StockResults
          branchId={branch.id}
          branchName={branch.name}
          q={search.q}
          low={search.low}
          negative={search.negative}
          onClear={() => {
            state.clear();
            searchRef.current?.focus();
          }}
        />
      </Suspense>
    </div>
  );
}
