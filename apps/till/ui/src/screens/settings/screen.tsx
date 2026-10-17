import { useState } from "react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { SettingsForm } from "../../components/settings/form";
import { takeFocus } from "../../hooks/focus";
import type { SettingsActions, SettingsSnapshot } from "../../settings/types";

export function SettingsScreen({
  snapshot,
  actions,
  active = true,
}: {
  snapshot: SettingsSnapshot;
  actions: SettingsActions;
  active?: boolean;
}) {
  // A new epoch remounts the form, which starts again from the host's latest saved settings.
  const [epoch, setEpoch] = useState(0);
  const { current, host } = snapshot;
  async function reload() {
    await actions.reload();
    setEpoch((value) => value + 1);
  }
  const registerShortcuts = useShortcuts(active && !current ? { F9: () => void reload() } : {});
  const register = (node: HTMLElement | null) => {
    const cleanup = registerShortcuts(node);
    takeFocus(node, active);
    return cleanup;
  };
  return (
    <main
      aria-label="Settings"
      className="flex h-full min-h-0 flex-col gap-4 outline-none"
      ref={register}
      tabIndex={-1}
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your register, receipts, and cashier preferences.
          </p>
        </div>
        {current && (
          <p className="text-xs text-muted-foreground">
            Register ID: {current.registerCode} · Currency: GHS
          </p>
        )}
      </header>
      {current ? (
        <SettingsForm
          actions={actions}
          active={active}
          current={current}
          key={epoch}
          onReload={() => void reload()}
          onReset={() => setEpoch((value) => value + 1)}
          onSaved={() => setEpoch((value) => value + 1)}
          snapshot={snapshot}
        />
      ) : host === "connecting" ? (
        <Loading />
      ) : (
        <Disconnected onReconnect={() => void reload()} />
      )}
    </main>
  );
}

function Loading() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" role="status">
      <span className="sr-only">Loading register settings</span>
      {["min-h-52", "min-h-52", "min-h-44", "min-h-44"].map((height, index) => (
        <div
          aria-hidden="true"
          className={`flex flex-col gap-3 rounded-lg border bg-card p-5 ${height}`}
          key={index}
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

function Disconnected({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="grid min-h-64 flex-1 place-items-center rounded-lg border bg-card px-5 text-center">
      <div className="flex flex-col items-center gap-3">
        <div>
          <p className="font-semibold">Register host disconnected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Settings load from the register host. Reconnect to view or change them.
          </p>
        </div>
        <Button
          aria-keyshortcuts="F9"
          onClick={onReconnect}
          size="touch"
          type="button"
          variant="outline"
        >
          Reconnect <Kbd className="max-sm:hidden">F9</Kbd>
        </Button>
      </div>
    </div>
  );
}
