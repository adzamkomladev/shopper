import { Suspense, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { CircleAlertIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { Gate, OfflineNote } from "../../../components/register/states";
import { SEARCH_ID, TransactionFilters } from "../../../components/transactions/list/filters";
import {
  NoTransactions,
  TransactionRowsSkeleton,
  TransactionsSkeleton,
} from "../../../components/transactions/list/states";
import { TransactionTable } from "../../../components/transactions/list/table";
import { StatusTabs } from "../../../components/transactions/list/tabs";
import { downloadFile } from "../../../lib/download";
import { focusIfIdle } from "../../../lib/focus";
import { rangePeriod } from "../../../lib/reports/range";
import {
  transactionParams,
  transactionRange,
  transactionsQuery,
} from "../../../queries/transactions/list";
import type { TransactionSearch } from "../../../schemas/transactions";

/** Every sale and unused MoMo payment, searched and filtered; a receipt opens its drill-down. */
export function TransactionsScreen() {
  const search = useSearch({ from: "/_shop/transactions" });
  const navigate = useNavigate({ from: "/transactions" });
  const online = useOnline();
  const [exporting, setExporting] = useState(false);
  const range = transactionRange(search);
  const go = (next: Partial<TransactionSearch>) =>
    navigate({ search: { ...search, ...next }, replace: true });
  const period = rangePeriod(range, go);
  const exportCsv = () => {
    if (exporting || !online) return;
    setExporting(true);
    downloadFile(
      `/transactions/export.csv?${transactionParams(search)}`,
      `transactions-${range.from}-${range.to}.csv`,
      {
        unreachable: "Could not reach the server to export the transactions.",
        denied: "You need the reports permission to export transactions.",
        failed: "The export failed. Try again.",
      },
    )
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setExporting(false));
  };
  const shortcuts = useShortcuts({
    "/": () => document.getElementById(SEARCH_ID)?.focus(),
    "[": () => period.onStep(-1),
    "]": () => period.onStep(1),
    E: exportCsv,
  });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          tabIndex={-1}
          ref={focusIfIdle}
          className="text-3xl font-bold tracking-tight outline-none"
        >
          Transactions
        </h1>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={exporting || !online}
          aria-keyshortcuts="E"
        >
          <DownloadIcon aria-hidden />
          {exporting ? "Exporting…" : "Export CSV"}
          <Kbd aria-hidden>E</Kbd>
        </Button>
      </div>
      <Gate need="report.read" what="transactions" fallback={<TransactionsSkeleton />}>
        {!online && (
          <OfflineNote>
            You can read the transactions loaded earlier; searching needs a connection.
          </OfflineNote>
        )}
        <TransactionFilters search={search} period={period} onChange={go} />
        <Suspense
          fallback={
            <StatusTabs search={search}>
              <TransactionRowsSkeleton />
            </StatusTabs>
          }
        >
          <Rows
            search={search}
            oneDay={range.from === range.to}
            onClear={() => navigate({ search: {}, replace: true })}
          />
        </Suspense>
      </Gate>
    </div>
  );
}

function Rows({
  search,
  oneDay,
  onClear,
}: {
  search: TransactionSearch;
  oneDay: boolean;
  onClear: () => void;
}) {
  const query = transactionsQuery(search);
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(query);
  const rows = data.pages.flatMap((page) => page.rows);
  const filtered = !!(search.q || search.tender || search.branchId || search.status);
  return (
    <StatusTabs search={search} counts={data.pages[0]?.counts}>
      {rows.length === 0 ? (
        <NoTransactions filtered={filtered} onClear={onClear} />
      ) : (
        <TransactionTable
          key={query.queryKey.join("|")}
          rows={rows}
          oneDay={oneDay}
          onEndReached={() =>
            hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage()
          }
        />
      )}
      {isFetchNextPageError && (
        <Alert variant="destructive" className="flex items-center gap-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex-1">Couldn't load more transactions.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Retry
          </Button>
        </Alert>
      )}
      {isFetchingNextPage && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Loading more transactions…
        </p>
      )}
    </StatusTabs>
  );
}
