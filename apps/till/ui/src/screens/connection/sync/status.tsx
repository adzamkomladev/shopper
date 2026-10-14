import type { HostStatus } from "@shopper/sync/bridge";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useNow } from "@shopper/ui/hooks/use-now";
import { StatusBadge } from "../status/card";
import type { HostConnection } from "../../../connection/store";
import { canSyncNow } from "../../../connection/sync";

// Warn at the final 10% of the active 1,000-number receipt block.
const receiptWarningAt = 100;

export function SyncStatus({
  host,
  status,
  onSyncNow,
}: {
  host: HostConnection;
  status: HostStatus | null;
  onSyncNow: () => void;
}) {
  const now = useNow(15_000);
  const view = statusView(host, status);
  const modeNotice = status ? modeNoticeFor(status, view.label) : null;
  const disabled = !canSyncNow(host, status);
  const help = disabled ? syncHelp(host, status) : null;

  return (
    <section
      aria-label="Sync status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
      role="region"
    >
      <div className="grid min-w-0 flex-1 gap-1 sm:flex sm:items-center sm:gap-3">
        <StatusBadge label={view.label} state={view.state} />
        <p className="min-w-0 text-xs leading-5 font-medium text-muted-foreground">
          {view.detail}
          {modeNotice && ` ${modeNotice}`}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:w-auto sm:justify-end">
        {status && (
          <p className="text-xs text-muted-foreground">
            {pendingLabel(status.pendingCount)} · {pullAge(status.lastPullAt, now)}
          </p>
        )}
        <Button
          aria-describedby={help ? "sync-now-help" : undefined}
          aria-keyshortcuts="Y"
          className="w-full sm:w-auto"
          disabled={disabled}
          onClick={onSyncNow}
          size="touch"
          variant="outline"
        >
          Sync now <Kbd className="pointer-coarse:inline-flex">Y</Kbd>
        </Button>
      </div>
      {help && (
        <p className="w-full text-xs text-muted-foreground" id="sync-now-help">
          {help}
        </p>
      )}
    </section>
  );
}

function statusView(host: HostConnection, status: HostStatus | null) {
  if (host === "connecting" || !status) {
    return {
      label: host === "disconnected" ? "Host disconnected" : "Connecting",
      state: host === "disconnected" ? ("problem" as const) : ("pending" as const),
      detail:
        host === "disconnected"
          ? "Reconnect the register to check its sync status."
          : "Opening the secure register connection.",
    };
  }
  if (status.server === "revoked")
    return {
      label: "Device revoked",
      state: "problem" as const,
      detail: "Enroll this register again to restore syncing.",
    };
  if (status.server === "incompatible" || status.lastError?.code === "UPGRADE_NEEDED")
    return {
      label: "Upgrade needed",
      state: "problem" as const,
      detail: "Update the register app to sync again.",
    };
  if (status.overflow && status.receiptsLeft === 0)
    return {
      label: "Receipt overflow",
      state: "problem" as const,
      detail: "Sales use overflow receipt numbers until the next block arrives.",
    };
  if (status.receiptsLeft <= receiptWarningAt)
    return {
      label: "Receipts low",
      state: "pending" as const,
      detail: `${status.receiptsLeft} receipts remaining across available blocks.`,
    };
  if (status.syncing)
    return {
      label: "Syncing",
      state: "pending" as const,
      detail: "Pulling the latest changes from the server.",
    };
  if (status.mode === "offline" || status.server === "offline")
    return {
      label: "Offline",
      state: "problem" as const,
      detail: "Sales stay on this register. Sync resumes when the server returns.",
    };
  if (status.mode === "polling")
    return {
      label: "Polling",
      state: "pending" as const,
      detail: "Checking for server changes periodically.",
    };
  if (status.server === "blocked")
    return {
      label: "Upload blocked",
      state: "problem" as const,
      detail: "Some sales need manager review before they can upload.",
    };
  return {
    label: "Live",
    state: "good" as const,
    detail:
      status.lastPullAt === null
        ? "Register is receiving changes as they arrive."
        : `Register synced · ${new Intl.DateTimeFormat("en-GH", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Accra",
          }).format(status.lastPullAt)}.`,
  };
}

function modeNoticeFor(status: HostStatus, label: string) {
  const halted = status.server === "revoked" || status.server === "incompatible";
  if (!halted && (status.mode === "offline" || status.server === "offline") && label !== "Offline")
    return "Sync is offline; sales stay on this register.";
  if (status.mode === "polling" && label !== "Polling") return "Polling for changes.";
  return null;
}

function pendingLabel(count: number) {
  return `${count} sale${count === 1 ? "" : "s"} waiting`;
}

function pullAge(lastPullAt: number | null, now: number) {
  if (lastPullAt === null) return "Waiting for first sync";
  const seconds = Math.max(0, Math.floor((now - lastPullAt) / 1_000));
  if (seconds < 10) return "Pulled just now";
  if (seconds < 60) return `Pulled ${seconds} sec ago`;
  if (seconds < 3_600) return `Pulled ${Math.floor(seconds / 60)} min ago`;
  return `Pulled ${Math.floor(seconds / 3_600)} hr ago`;
}

function syncHelp(host: HostConnection, status: HostStatus | null) {
  if (host !== "connected") return "Connect to the register host before syncing.";
  if (status?.syncing) return "A sync is already in progress.";
  if (status?.server === "revoked") return "Enroll this register again before syncing.";
  if (status?.server === "incompatible") return "Update the register app before syncing.";
  return "Sync is unavailable right now.";
}
