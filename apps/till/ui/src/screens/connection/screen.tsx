import { useState } from "react";
import { CircleAlert, Store } from "lucide-react";
import { About } from "@shopper/ui/components/about";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@shopper/ui/components/dialog";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { connectRegister, retryUpload, useConnectionSnapshot } from "../../connection/store";
import {
  errorTitle,
  hostDetail,
  IdentityRow,
  IdentitySkeleton,
  serverDetail,
  serverLabelFor,
  serverState,
} from "./details";
import { StatusCard } from "./status/card";
import { canSyncNow } from "../../connection/sync";
import { SyncStatus } from "./sync/status";

/** `onSell` opens the sale screen; it is offered once the register host is connected. */
export function ConnectionScreen({ onSell }: { onSell: () => void }) {
  const connection = useConnectionSnapshot();
  const status = connection.status;
  const [aboutOpen, setAboutOpen] = useState(false);
  const syncNow = () => {
    if (canSyncNow(connection.host, status)) retryUpload();
  };
  const registerShortcuts = useShortcuts({
    C: connectRegister,
    Y: syncNow,
    A: () => setAboutOpen(true),
    S: () => connection.host === "connected" && onSell(),
  });
  const shortcuts = (node: HTMLElement | null) => {
    const cleanup = registerShortcuts(node);
    if (node && document.activeElement === document.body) node.focus();
    return cleanup;
  };
  const server =
    connection.host === "connecting"
      ? "connecting"
      : connection.host === "disconnected"
        ? null
        : (status?.server ?? null);
  const serverLabel = server ? serverLabelFor(server) : "Not connected";
  const error =
    connection.error ??
    (status?.server === "blocked"
      ? "A sale was rejected. It remains saved. Ask a manager to investigate."
      : (status?.lastError?.message ?? null));
  const connectLabel =
    connection.host === "connecting"
      ? "Connecting…"
      : connection.host === "connected"
        ? "Reconnect"
        : "Connect register";

  return (
    <main
      className="mx-auto flex w-full max-w-7xl flex-col gap-7 focus:outline-none"
      ref={shortcuts}
      tabIndex={-1}
    >
      <header className="flex flex-col gap-3 border-b pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <Store aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {status?.identity.shopName ?? "Shopper register"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {status?.identity.registerName ?? "Register not connected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              aria-keyshortcuts="S"
              disabled={connection.host !== "connected"}
              onClick={onSell}
              size="touch"
            >
              Start selling <Kbd className="pointer-coarse:inline-flex">S</Kbd>
            </Button>
            <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
              <DialogTrigger asChild>
                <Button aria-label="About" aria-keyshortcuts="A" variant="outline" size="touch">
                  About <Kbd className="pointer-coarse:inline-flex">A</Kbd>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>About Shopper</DialogTitle>
                <DialogDescription>Register application details.</DialogDescription>
                <About channel={status?.update?.channel} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <SyncStatus host={connection.host} status={status} onSyncNow={syncNow} />
      </header>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">Register connection</h1>
            <p className="text-sm text-muted-foreground">
              Check this register’s host and server connection.
            </p>
          </div>
          <Badge variant="secondary" className="h-7 px-3">
            Register
          </Badge>
        </div>

        {error && (
          <Alert variant={server === "blocked" || server === "revoked" ? "destructive" : "default"}>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>{errorTitle(server, connection.host)}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            aria-label="Register and store identity"
            className="gap-4 py-4 shadow-none"
            role="region"
          >
            <CardHeader className="gap-1 px-5">
              <CardTitle className="text-base">Register &amp; store</CardTitle>
              <CardDescription>Shop and register details for this till.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-5">
              {connection.host === "connecting" && !status ? (
                <div aria-label="Loading register identity" className="grid gap-4" role="status">
                  <IdentitySkeleton label="Shop" />
                  <IdentitySkeleton label="Register" />
                </div>
              ) : (
                <>
                  <IdentityRow
                    label="Shop"
                    value={status?.identity.shopName ?? "Waiting for host"}
                  />
                  <IdentityRow
                    label="Register"
                    value={status?.identity.registerName ?? "Not connected"}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <StatusCard
            kind="host"
            title="Host connection"
            description="The local till host stores sales on this device."
            label={
              connection.host === "connected"
                ? "Connected"
                : connection.host === "connecting"
                  ? "Connecting"
                  : "Disconnected"
            }
            state={
              connection.host === "connected"
                ? "good"
                : connection.host === "connecting"
                  ? "pending"
                  : "problem"
            }
            detail={hostDetail(connection.host)}
          >
            <Button
              aria-keyshortcuts="C"
              className="w-full sm:w-fit"
              disabled={connection.host === "connecting"}
              onClick={connectRegister}
              size="touch"
            >
              {connectLabel} <Kbd className="pointer-coarse:inline-flex">C</Kbd>
            </Button>
          </StatusCard>

          <div className="lg:col-span-2">
            <StatusCard
              kind="server"
              title="Server connection"
              description={
                status?.blockedCount
                  ? "Sync sends eligible waiting sales; blocked sales remain saved and unchanged."
                  : "Sales upload to the server when it is available."
              }
              label={serverLabel}
              state={serverState(server)}
              detail={serverDetail(server, status?.pendingCount ?? 0, status?.blockedCount ?? 0)}
            >
              <dl className="grid w-fit grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Waiting to upload</dt>
                <dd className="text-right font-medium tabular-nums">{status?.pendingCount ?? 0}</dd>
                <dt className="text-muted-foreground">Blocked</dt>
                <dd className="text-right font-medium tabular-nums">{status?.blockedCount ?? 0}</dd>
              </dl>
              {status?.lastSuccessfulPushAt !== null &&
                status?.lastSuccessfulPushAt !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Last upload{" "}
                    {new Intl.DateTimeFormat("en-GH", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Accra",
                    }).format(status.lastSuccessfulPushAt)}
                  </p>
                )}
            </StatusCard>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
        <p>Sales remain on this register after they upload.</p>
      </footer>
    </main>
  );
}
