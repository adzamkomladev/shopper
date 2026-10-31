import { CircleAlert, Download, LogOut, RotateCw, WifiOff } from "lucide-react";
import { buildInfo } from "@shopper/config";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { UpdateStatus } from "@shopper/sync/bridge";
import { TitleBar } from "../../components/shell/titlebar";

/**
 * Update required: this build is below the server's minimum and no shift is open, so none opens until it updates.
 * Main installs a required update by itself once it is downloaded; Restart now is for when that has not happened.
 */
export function UpdateScreen({
  update,
  offline,
  onRestart,
  onRetry,
  onSignOut,
}: {
  update: UpdateStatus;
  /** The server is unreachable, so the feed is too. */
  offline: boolean;
  onRestart: () => void;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const ready = update.state === "ready";
  const failed = !ready && update.state === "error";
  const register = useShortcuts({
    ...(ready && { "Alt+U": onRestart }),
    ...(failed && { "Alt+R": onRetry }),
  });
  const wanted = update.version ?? update.minVersion;
  return (
    <div className="flex h-svh min-h-0 flex-col bg-background" ref={register}>
      <TitleBar />
      <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-8">
        <div className="grid w-full max-w-xl gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-4xl font-semibold tracking-tight">Update required</h1>
            <p className="text-base text-muted-foreground">
              This register runs version {buildInfo.version}. The shop needs version {wanted} or
              newer before a new shift can open.
            </p>
          </div>
          {offline && !ready ? (
            <Alert role="status">
              <WifiOff aria-hidden="true" />
              <AlertTitle>You are offline</AlertTitle>
              <AlertDescription>
                Connect this register to the internet. The update downloads as soon as it is back
                online.
              </AlertDescription>
            </Alert>
          ) : failed ? (
            <Alert role="alert" variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>The download did not finish</AlertTitle>
              <AlertDescription>Check the internet connection, then try again.</AlertDescription>
            </Alert>
          ) : ready ? (
            <Alert role="status">
              <Download aria-hidden="true" />
              <AlertTitle>Version {update.version} is ready</AlertTitle>
              <AlertDescription>The register restarts to install it.</AlertDescription>
            </Alert>
          ) : update.state === "downloading" ? (
            <Progress percent={update.percent ?? 0} />
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm font-medium" role="status">
              <RotateCw
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              Looking for the update
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {ready && (
              <Button aria-keyshortcuts="Alt+U" autoFocus onClick={onRestart} size="touch">
                Restart now <Kbd className="max-sm:hidden">Alt+U</Kbd>
              </Button>
            )}
            {failed && (
              <Button aria-keyshortcuts="Alt+R" autoFocus onClick={onRetry} size="touch">
                Retry <Kbd className="max-sm:hidden">Alt+R</Kbd>
              </Button>
            )}
            <Button onClick={onSignOut} size="touch" variant="outline">
              <LogOut aria-hidden="true" /> Sign out
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Progress({ percent }: { percent: number }) {
  return (
    <div className="grid gap-2" role="status">
      <div className="flex justify-between text-sm font-medium">
        <span>Downloading the update</span>
        <span>{percent}%</span>
      </div>
      <div
        aria-label="Download progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
