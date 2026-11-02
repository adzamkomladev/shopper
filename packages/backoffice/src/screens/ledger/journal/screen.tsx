import { Suspense, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { JournalEditor } from "../../../components/ledger/journal/editor";
import { JournalList } from "../../../components/ledger/journal/list";
import { ReverseDialog } from "../../../components/ledger/journal/reverse";
import { LedgerRange } from "../../../components/ledger/range";
import { LinesSkeleton, NothingPosted, RangeSkeleton } from "../../../components/ledger/states";
import { LedgerPage } from "../../../components/ledger/tabs";
import { Gate } from "../../../components/register/states";
import { usePanel } from "../../../hooks/admin/panel";
import { ledgerRange } from "../../../lib/ledger/range";
import { chartQuery, journalQuery } from "../../../queries/ledger/books";
import { usePermissions } from "../../../queries/session/permissions";
import type { JournalEntryView } from "../../../schemas/ledger/views";

const NEW_ID = "ledger-entry-new";

/** Every entry posted in a range, newest first; N writes a manual entry and each can be reversed once. */
export function LedgerJournalScreen() {
  const search = useSearch({ from: "/_shop/ledger/journal" });
  const navigate = useNavigate();
  const range = ledgerRange(search);
  const online = useOnline();
  const canWrite = !!usePermissions()?.includes("ledger.write");
  const chart = useQuery({ ...chartQuery(), enabled: canWrite });
  const fallback = useRef<HTMLButtonElement>(null);
  const editor = usePanel(fallback);
  const reverser = usePanel<JournalEntryView>(fallback);
  const ready = canWrite && online && !!chart.data;
  const shortcuts = useShortcuts({ N: () => ready && editor.show(undefined, NEW_ID) });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col">
      <LedgerPage
        active="journal"
        action={
          canWrite && (
            <Button
              id={NEW_ID}
              ref={fallback}
              aria-keyshortcuts="N"
              disabled={!ready}
              onClick={() => editor.show(undefined, NEW_ID)}
            >
              <PlusIcon aria-hidden />
              New entry
            </Button>
          )
        }
      >
        <Gate
          need="ledger.read"
          what="the books"
          fallback={<RangeSkeleton label="Loading the journal" />}
        >
          <LedgerRange
            {...range}
            onChange={(change) =>
              void navigate({
                to: "/ledger/journal",
                search: { ...range, ...change },
                replace: true,
              })
            }
          />
          <Suspense fallback={<LinesSkeleton label="Loading the journal" />}>
            <Entries
              {...range}
              onReverse={
                canWrite && online ? (entry, trigger) => reverser.show(entry, trigger) : undefined
              }
            />
          </Suspense>
        </Gate>
      </LedgerPage>
      {editor.open && chart.data && (
        <JournalEditor
          accounts={chart.data.accounts}
          lockedThrough={chart.data.lockedThrough}
          open={editor.open}
          onOpenChange={editor.setOpen}
          restoreFocus={editor.restoreFocus}
        />
      )}
      {reverser.value && (
        <ReverseDialog
          key={reverser.value.id}
          entry={reverser.value}
          open={reverser.open}
          onOpenChange={reverser.setOpen}
          restoreFocus={reverser.restoreFocus}
        />
      )}
    </div>
  );
}

function Entries({
  from,
  to,
  onReverse,
}: {
  from: string;
  to: string;
  onReverse?: (entry: JournalEntryView, trigger: string) => void;
}) {
  const { data } = useSuspenseQuery(journalQuery(from, to));
  if (data.entries.length === 0) return <NothingPosted what={`from ${from} to ${to}`} />;
  return (
    <div className="flex flex-col gap-3">
      {data.truncated && (
        <p className="text-sm text-muted-foreground" role="status">
          Showing the newest {data.entries.length} entries. Narrow the dates to see the rest.
        </p>
      )}
      <JournalList entries={data.entries} onReverse={onReverse} />
    </div>
  );
}
