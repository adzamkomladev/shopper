import { Suspense, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { BranchPicker } from "../../../../components/inventory/picker";
import { NoBranch } from "../../../../components/inventory/stock/list/states";
import { InventoryPage } from "../../../../components/inventory/tabs";
import { TakesTable } from "../../../../components/inventory/takes/list/table";
import {
  NoTakes,
  TakesBodySkeleton,
  TakesResultsSkeleton,
} from "../../../../components/inventory/takes/list/states";
import { StartTakeDialog } from "../../../../components/inventory/takes/start";
import { Gate, OfflineNote } from "../../../../components/register/states";
import { useTakesShortcuts } from "../../../../hooks/inventory/takes/shortcuts";
import { pickBranch } from "../../../../lib/inventory/format";
import { stockBranchesQuery } from "../../../../queries/inventory/stock";
import { takesListQuery } from "../../../../queries/inventory/takes";
import { usePermissions } from "../../../../queries/session/permissions";

/** The stock takes of one branch, newest first; a row opens the count sheet, and N starts a take. */
export function TakesScreen() {
  const canWrite = !!usePermissions()?.includes("stock.write");
  const online = useOnline();
  const [starting, setStarting] = useState(false);
  return (
    <InventoryPage
      active="takes"
      action={
        canWrite && (
          <Button onClick={() => setStarting(true)} disabled={!online}>
            Start a stock take
            <Kbd aria-hidden className="bg-primary-foreground/5">
              N
            </Kbd>
          </Button>
        )
      }
    >
      <Gate need="stock.read" what="stock takes" fallback={<TakesBodySkeleton />}>
        <TakesBody canWrite={canWrite} starting={starting} onStartingChange={setStarting} />
      </Gate>
    </InventoryPage>
  );
}

type BodyProps = {
  canWrite: boolean;
  starting: boolean;
  onStartingChange: (starting: boolean) => void;
};

function TakesBody({ canWrite, starting, onStartingChange }: BodyProps) {
  const search = useSearch({ from: "/_shop/stock/takes" });
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(stockBranchesQuery());
  const online = useOnline();
  const [branchOpen, setBranchOpen] = useState(false);
  const branch = pickBranch(data.branches, search.branch);
  const shortcuts = useTakesShortcuts(
    canWrite && online,
    () => onStartingChange(true),
    () => setBranchOpen(true),
  );
  if (!branch) return <NoBranch />;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing the takes loaded earlier. Starting or counting a take needs a connection.
        </OfflineNote>
      )}
      <BranchPicker
        branches={data.branches}
        branchId={branch.id}
        onBranchChange={(id) =>
          void navigate({
            to: "/stock/takes",
            search: (previous: object) => ({ ...previous, branch: id }),
            replace: true,
          })
        }
        open={branchOpen}
        onOpenChange={setBranchOpen}
      />
      <Suspense fallback={<TakesResultsSkeleton />}>
        <TakesResults
          branchId={branch.id}
          branchName={branch.name}
          canWrite={canWrite}
          online={online}
          onStart={() => onStartingChange(true)}
        />
      </Suspense>
      <StartTakeDialog
        open={starting}
        onOpenChange={onStartingChange}
        branchId={branch.id}
        branchName={branch.name}
        onStarted={(takeId) =>
          void navigate({ to: "/stock/takes/$takeId", params: { takeId }, search: {} })
        }
      />
    </div>
  );
}

type ResultsProps = {
  branchId: string;
  branchName: string;
  canWrite: boolean;
  online: boolean;
  onStart: () => void;
};

/** The part of the screen that waits for the takes: the table, or what stands in for it. */
function TakesResults({ branchId, branchName, canWrite, online, onStart }: ResultsProps) {
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(takesListQuery(branchId));
  const takes = data.pages.flatMap((page) => page.items);
  if (takes.length === 0)
    return (
      <NoTakes branchName={branchName} canWrite={canWrite} online={online} onStart={onStart} />
    );
  return (
    <>
      <TakesTable
        // Another branch starts the table over, including its "end reached" bookkeeping.
        key={branchId}
        takes={takes}
        onEndReached={() =>
          hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage()
        }
      />
      {isFetchNextPageError && (
        <Alert variant="destructive" className="flex items-center gap-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex-1">Couldn't load more takes.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Retry
          </Button>
        </Alert>
      )}
      {isFetchingNextPage && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Loading more takes…
        </p>
      )}
    </>
  );
}
