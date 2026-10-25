import { useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { Gate, OfflineNote } from "../../../components/register/states";
import { FiscalArchiveList } from "../../../components/tax/fiscal/archive";
import { FiscalSegments } from "../../../components/tax/fiscal/segments";
import { FiscalDocSheet } from "../../../components/tax/fiscal/sheet";
import {
  FiscalSkeleton,
  NoFiscalDocs,
  SdcNotConnected,
} from "../../../components/tax/fiscal/states";
import { FiscalTable } from "../../../components/tax/fiscal/table";
import { TaxPage } from "../../../components/tax/tabs";
import { usePanel } from "../../../hooks/admin/panel";
import { FISCAL_SEGMENTS } from "../../../lib/tax/fiscal";
import { shopToday } from "../../../lib/tax/dates";
import { usePermissions } from "../../../queries/session/permissions";
import {
  fiscalArchivesQuery,
  fiscalDocQuery,
  fiscalListQuery,
  useRetryFiscal,
} from "../../../queries/tax/fiscal";
import type { FiscalRow } from "../../../schemas/tax/fiscal";

const SEARCH_ID = "fiscal-search";

/** Every VAT invoice and credit note on its way to the GRA SDC, by status, with the hourly archive below. */
export function FiscalScreen() {
  return (
    <TaxPage active="fiscal">
      <Gate need="tax.read" what="fiscal documents" fallback={<FiscalSkeleton />}>
        <FiscalBody />
      </Gate>
    </TaxPage>
  );
}

function FiscalBody() {
  const search = useSearch({ from: "/_shop/tax/fiscal" });
  const navigate = useNavigate({ from: "/tax/fiscal" });
  const segment = search.status ?? "all";
  const date = search.date ?? shopToday();
  const { data } = useSuspenseQuery(fiscalListQuery(search));
  const { data: archive } = useSuspenseQuery(fiscalArchivesQuery(date));
  const online = useOnline();
  const canRetry = !!usePermissions()?.includes("tax.write");
  const fallback = useRef<HTMLInputElement>(null);
  const panel = usePanel<FiscalRow>(fallback);
  const detail = useQuery({ ...fiscalDocQuery(panel.value?.id ?? ""), enabled: !!panel.value });
  const retry = useRetryFiscal(() => panel.setOpen(false));
  const retryable =
    canRetry && online && panel.open && (detail.data?.status ?? panel.value?.status) === "dead";
  const shortcuts = useShortcuts({
    "/": () => fallback.current?.focus(),
    R: () => retryable && !retry.isPending && retry.mutate(panel.value!.id),
    ...Object.fromEntries(
      FISCAL_SEGMENTS.map(({ value }, index) => [
        String(index + 1),
        () => navigate({ search: { ...search, status: value }, replace: true }),
      ]),
    ),
  });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {!data.connected && <SdcNotConnected />}
      {!online && (
        <OfflineNote>
          You can read the documents loaded earlier; retrying needs a connection.
        </OfflineNote>
      )}
      <FiscalSegments active={segment} counts={data.counts} search={search}>
        <form
          role="search"
          className="relative w-full max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            const q = fallback.current?.value.trim();
            void navigate({ search: { ...search, q: q || undefined } });
          }}
        >
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            key={search.q}
            ref={fallback}
            id={SEARCH_ID}
            name="q"
            type="search"
            aria-label="Search by receipt number"
            aria-keyshortcuts="/"
            placeholder="Search by receipt number"
            defaultValue={search.q}
            className="pr-10 pl-9"
          />
          <Kbd aria-hidden className="absolute top-1/2 right-3 -translate-y-1/2">
            /
          </Kbd>
        </form>
        {data.documents.length ? (
          <FiscalTable rows={data.documents} onOpen={(row, trigger) => panel.show(row, trigger)} />
        ) : (
          <NoFiscalDocs segment={segment} search={search.q} />
        )}
      </FiscalSegments>
      <FiscalArchiveList
        date={date}
        archives={archive.archives}
        onDate={(next) => navigate({ search: { ...search, date: next }, replace: true })}
      />
      <FiscalDocSheet
        row={panel.value}
        doc={detail.data}
        open={panel.open}
        onOpenChange={panel.setOpen}
        restoreFocus={panel.restoreFocus}
        onRetry={retryable ? () => retry.mutate(panel.value!.id) : undefined}
        retrying={retry.isPending}
        error={retry.error?.message}
        readError={
          detail.error
            ? { message: detail.error.message, retry: () => void detail.refetch() }
            : undefined
        }
      />
    </div>
  );
}
