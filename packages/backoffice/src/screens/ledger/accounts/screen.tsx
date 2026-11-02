import { useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LockIcon, PlusIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ReadOnlyNote } from "../../../components/admin/states";
import { LedgerAccountDialog } from "../../../components/ledger/accounts/dialog";
import { LockDialog } from "../../../components/ledger/accounts/lock";
import { AccountsTable } from "../../../components/ledger/accounts/table";
import { ChartSkeleton } from "../../../components/ledger/states";
import { LedgerPage } from "../../../components/ledger/tabs";
import { Gate } from "../../../components/register/states";
import { usePanel } from "../../../hooks/admin/panel";
import { chartQuery } from "../../../queries/ledger/books";
import { usePermissions } from "../../../queries/session/permissions";
import type { ChartRow } from "../../../schemas/ledger/views";

const NEW_ID = "ledger-account-new";
const LOCK_ID = "ledger-lock";

/** The chart of accounts with balances to date; N adds an account and L sets the lock date. */
export function LedgerAccountsScreen() {
  const permissions = usePermissions();
  const online = useOnline();
  const canWrite = online && !!permissions?.includes("ledger.write");
  const canLock = online && !!permissions?.includes("ledger.lock");
  const fallback = useRef<HTMLButtonElement>(null);
  const editor = usePanel<ChartRow>(fallback);
  const locker = usePanel(fallback);
  const shortcuts = useShortcuts({
    N: () => canWrite && editor.show(undefined, NEW_ID),
    L: () => canLock && locker.show(undefined, LOCK_ID),
  });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col">
      <LedgerPage
        active="accounts"
        action={
          <div className="flex flex-wrap gap-2">
            {permissions?.includes("ledger.lock") && (
              <Button
                id={LOCK_ID}
                variant="outline"
                aria-keyshortcuts="L"
                disabled={!online}
                onClick={() => locker.show(undefined, LOCK_ID)}
              >
                <LockIcon aria-hidden />
                Lock date
              </Button>
            )}
            {permissions?.includes("ledger.write") && (
              <Button
                id={NEW_ID}
                ref={fallback}
                aria-keyshortcuts="N"
                disabled={!online}
                onClick={() => editor.show(undefined, NEW_ID)}
              >
                <PlusIcon aria-hidden />
                Add account
              </Button>
            )}
          </div>
        }
      >
        <Gate need="ledger.read" what="the books" fallback={<ChartSkeleton />}>
          <ChartBody
            onEdit={canWrite ? (row, trigger) => editor.show(row, trigger) : undefined}
            lock={locker}
          />
          {!permissions?.includes("ledger.write") && (
            <ReadOnlyNote>Your role can read the books but not post to them.</ReadOnlyNote>
          )}
        </Gate>
      </LedgerPage>
      {editor.open && (
        <LedgerAccountDialog
          key={editor.value?.id ?? "new"}
          account={editor.value}
          open={editor.open}
          onOpenChange={editor.setOpen}
          restoreFocus={editor.restoreFocus}
        />
      )}
    </div>
  );
}

function ChartBody({
  onEdit,
  lock,
}: {
  onEdit?: (row: ChartRow, trigger: string) => void;
  lock: ReturnType<typeof usePanel<undefined>>;
}) {
  const { data } = useSuspenseQuery(chartQuery());
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {data.lockedThrough
          ? `The books are locked through ${data.lockedThrough}. Later syncs from before it post on the next open day.`
          : "The books are open: no period is locked yet."}
      </p>
      <AccountsTable rows={data.accounts} onEdit={onEdit} />
      {lock.open && (
        <LockDialog
          lockedThrough={data.lockedThrough}
          open={lock.open}
          onOpenChange={lock.setOpen}
          restoreFocus={lock.restoreFocus}
        />
      )}
    </div>
  );
}
