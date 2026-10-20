import { Suspense, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { keepPreviousData, useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { BranchPicker } from "../../../../components/inventory/picker";
import { InventoryPage } from "../../../../components/inventory/tabs";
import { RecordActions } from "../../../../components/inventory/records/actions";
import { Segments } from "../../../../components/inventory/records/segments";
import { RecordsResults } from "../../../../components/inventory/records/results";
import {
  RecordsBodySkeleton,
  RecordsResultsSkeleton,
} from "../../../../components/inventory/records/states";
import { NoBranch } from "../../../../components/inventory/stock/list/states";
import { Gate, OfflineNote } from "../../../../components/register/states";
import { useRecordShortcuts } from "../../../../hooks/inventory/records/shortcuts";
import { pickBranch } from "../../../../lib/inventory/format";
import { recordsListQuery } from "../../../../queries/inventory/records";
import type { RecordsSearch } from "../../../../queries/inventory/types";
import { stockBranchesQuery } from "../../../../queries/inventory/stock";
import { usePermissions } from "../../../../queries/session/permissions";

/** Receipts, adjustments and counts at one branch, newest first; a row opens the record. */
export function RecordsScreen() {
  const canWrite = !!usePermissions()?.includes("stock.write");
  const branch = useSearch({ from: "/_shop/stock/records", select: (search) => search.branch });
  return (
    <InventoryPage active="records" action={canWrite && <RecordActions branchId={branch} />}>
      <Gate need="stock.read" what="stock records" fallback={<RecordsBodySkeleton />}>
        <RecordsBody canWrite={canWrite} />
      </Gate>
    </InventoryPage>
  );
}

function RecordsBody({ canWrite }: { canWrite: boolean }) {
  const search = useSearch({ from: "/_shop/stock/records" });
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(stockBranchesQuery());
  const online = useOnline();
  const [branchOpen, setBranchOpen] = useState(false);
  const branch = pickBranch(data.branches, search.branch);
  const shortcuts = useRecordShortcuts(branch?.id ?? "", canWrite, () => setBranchOpen(true));
  if (!branch) return <NoBranch />;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing the records loaded earlier. Recording new stock needs a connection.
        </OfflineNote>
      )}
      <BranchPicker
        branches={data.branches}
        branchId={branch.id}
        onBranchChange={(id) =>
          void navigate({
            to: "/stock/records",
            search: (previous: object) => ({ ...previous, branch: id }),
            replace: true,
          })
        }
        open={branchOpen}
        onOpenChange={setBranchOpen}
      />
      <RecordsPanel
        branchId={branch.id}
        branchName={branch.name}
        kind={search.kind}
        canWrite={canWrite}
      />
    </div>
  );
}

type PanelProps = {
  branchId: string;
  branchName: string;
  kind: RecordsSearch["kind"];
  canWrite: boolean;
};

/**
 * The kind segments, then the records. The segments sit outside the Suspense, so switching kind
 * from the keyboard keeps focus on the segment; only the table underneath waits.
 */
function RecordsPanel({ branchId, branchName, kind, canWrite }: PanelProps) {
  // The counts ride on every page; the previous ones stay while another kind loads.
  const { data } = useInfiniteQuery({
    ...recordsListQuery({ branchId, kind }),
    placeholderData: keepPreviousData,
  });
  return (
    <Segments counts={data?.pages[0]?.counts} kind={kind} branchId={branchId}>
      <Suspense fallback={<RecordsResultsSkeleton />}>
        <RecordsResults
          branchId={branchId}
          branchName={branchName}
          kind={kind}
          canWrite={canWrite}
        />
      </Suspense>
    </Segments>
  );
}
