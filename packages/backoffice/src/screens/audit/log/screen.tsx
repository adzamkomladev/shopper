import { Suspense, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CircleAlertIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { Gate, OfflineNote } from "../../../components/register/states";
import { AuditFilters, FILTERS_ID } from "../../../components/audit/log/filters";
import { AuditEntrySheet } from "../../../components/audit/log/sheet";
import {
  AuditLogSkeleton,
  AuditRowsSkeleton,
  NoAuditEntries,
} from "../../../components/audit/log/states";
import { AuditTable, entryButtonId } from "../../../components/audit/log/table";
import { AuditPage } from "../../../components/audit/tabs";
import { downloadFile } from "../../../lib/download";
import { shopToday } from "../../../lib/tax/dates";
import {
  auditEntryQuery,
  auditFacetsQuery,
  auditListQuery,
  auditParams,
} from "../../../queries/audit/log";
import type { AuditSearch } from "../../../schemas/audit";

/** Every change in the back office and at every till, filtered, newest first; an entry opens its before and after. */
export function AuditLogScreen() {
  const search = useSearch({ from: "/_shop/audit" });
  const [exporting, setExporting] = useState(false);
  const online = useOnline();
  const exportCsv = () => {
    if (exporting || !online) return;
    setExporting(true);
    downloadFile(`/audit/export.csv?${auditParams(search)}`, `audit-${shopToday()}.csv`, {
      unreachable: "Could not reach the server to export the log.",
      denied: "You need the audit permission to export the log.",
      failed: "The export failed. Try again.",
    })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setExporting(false));
  };
  const shortcuts = useShortcuts({
    "/": () => document.getElementById(FILTERS_ID)?.focus(),
    E: exportCsv,
  });
  return (
    <AuditPage
      active="log"
      action={
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
      }
    >
      <Gate need="audit.read" what="the audit log" fallback={<AuditLogSkeleton />}>
        <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
          {!online && (
            <OfflineNote>
              You can read the entries loaded earlier; filters need a connection.
            </OfflineNote>
          )}
          <LogBody search={search} />
        </div>
      </Gate>
    </AuditPage>
  );
}

function LogBody({ search }: { search: AuditSearch }) {
  const navigate = useNavigate({ from: "/audit" });
  const { data: facets } = useSuspenseQuery(auditFacetsQuery());
  const filter = (next: Partial<AuditSearch>) =>
    navigate({ search: { ...search, ...next, entry: undefined }, replace: true });
  const clear = () => navigate({ search: {}, replace: true });
  // The open entry lives in the address; the last one stays shown while the sheet animates closed.
  const [shown, setShown] = useState(search.entry);
  if (search.entry && search.entry !== shown) setShown(search.entry);
  const detail = useQuery({ ...auditEntryQuery(shown ?? ""), enabled: !!shown });
  const filtered = Object.entries(search).some(([key, value]) => key !== "entry" && value);
  return (
    <>
      <AuditFilters search={search} facets={facets} onChange={filter} onClear={clear} />
      <Suspense fallback={<AuditRowsSkeleton />}>
        <Entries
          search={search}
          filtered={filtered}
          onClear={clear}
          onOpen={(id) => navigate({ search: { ...search, entry: id } })}
        />
      </Suspense>
      <AuditEntrySheet
        entry={detail.data}
        open={!!search.entry}
        onOpenChange={(open) => !open && navigate({ search: { ...search, entry: undefined } })}
        // A linked entry may have no row on the page: the heading takes focus instead.
        restoreFocus={() =>
          (
            document.getElementById(entryButtonId(shown ?? "")) ??
            document.querySelector<HTMLElement>("main h1")
          )?.focus()
        }
        readError={
          detail.error
            ? { message: detail.error.message, retry: () => void detail.refetch() }
            : undefined
        }
      />
    </>
  );
}

type EntriesProps = {
  search: AuditSearch;
  filtered: boolean;
  onClear: () => void;
  onOpen: (id: string) => void;
};

function Entries({ search, filtered, onClear, onOpen }: EntriesProps) {
  const query = auditListQuery(search);
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(query);
  const rows = data.pages.flatMap((page) => page.entries);
  if (!rows.length) return <NoAuditEntries filtered={filtered} onClear={onClear} />;
  return (
    <>
      <AuditTable
        // New filters start the table over, including its "end reached" bookkeeping.
        key={query.queryKey.join("|")}
        rows={rows}
        onOpen={(row) => onOpen(row.id)}
        onEndReached={() =>
          hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage()
        }
      />
      {isFetchNextPageError && (
        <Alert variant="destructive" className="flex items-center gap-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription className="flex-1">Couldn't load more entries.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Retry
          </Button>
        </Alert>
      )}
      {isFetchingNextPage && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          Loading more entries…
        </p>
      )}
    </>
  );
}
