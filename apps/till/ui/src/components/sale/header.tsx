import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { HostConnection } from "../../connection/types";
import type { SaleSync } from "../../sale/types";

function syncSummary(sync: SaleSync) {
  const waiting = `${sync.pendingCount} sale${sync.pendingCount === 1 ? "" : "s"} waiting to upload`;
  if (sync.syncing) return `Syncing · ${waiting}`;
  return `${sync.offline ? "Server offline" : "Server online"} · ${waiting}`;
}

/** Figma "Checkout" heading, with sync state and Sync now beside it. */
export function SaleHeader({
  host,
  sync,
  onSyncNow,
  onRegister,
}: {
  host: HostConnection;
  sync: SaleSync;
  onSyncNow: () => void;
  onRegister: () => void;
}) {
  const reason =
    sync.canSync || sync.syncing
      ? null
      : host === "connected"
        ? "Sync is unavailable right now."
        : "Reconnect to the register host to sync.";
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2">
      <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
      <div aria-live="polite" className="flex min-w-0 items-center gap-2 sm:gap-3">
        <p
          className="hidden truncate text-sm font-medium text-muted-foreground sm:block"
          id="sale-sync-note"
        >
          {reason ?? syncSummary(sync)}
        </p>
        <Button
          aria-keyshortcuts="F10"
          className="px-2 sm:px-4"
          onClick={onRegister}
          size="touch"
          variant="outline"
        >
          Register <Kbd className="hidden sm:inline-flex">F10</Kbd>
        </Button>
        <Button
          aria-describedby="sale-sync-note"
          aria-keyshortcuts="F8"
          disabled={!sync.canSync}
          className="px-2 sm:px-4"
          onClick={onSyncNow}
          size="touch"
        >
          {sync.syncing ? "Syncing…" : "Sync now"} <Kbd className="hidden sm:inline-flex">F8</Kbd>
        </Button>
      </div>
    </header>
  );
}
