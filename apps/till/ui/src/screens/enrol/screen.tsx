import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { EnrolForm } from "../../components/enrol/form";
import { EnrolServerPanel } from "../../components/enrol/server";
import { TitleBar } from "../../components/shell/titlebar";
import type { EnrolServer, HostConnection } from "../../connection/types";
import type { EnrolOutcome, ServerOutcome } from "../../enrol/types";
import type { EnrolInput } from "../../schemas/enrol";

/**
 * Figma "New Login", for a till fresh from the installer: the app name, what to do, and the codes the portal
 * shows when the owner creates one. It reports the attempt through `onSubmit`.
 */
export function EnrolScreen({
  host,
  server,
  onSubmit,
  onServer,
  onReconnect,
}: {
  host: HostConnection;
  server: EnrolServer;
  onSubmit: (input: EnrolInput) => Promise<EnrolOutcome>;
  onServer: (address: string) => Promise<ServerOutcome>;
  onReconnect: () => void;
}) {
  const register = useShortcuts({ "Alt+C": onReconnect });
  return (
    <div className="flex h-svh min-h-0 flex-col bg-background" ref={register}>
      <TitleBar />
      <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-8">
        <div className="grid w-full max-w-md gap-6 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="grid gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Set up this till</h1>
            <p className="text-sm text-muted-foreground">
              In the portal, open Devices and choose Create enrolment code. Type the codes it shows,
              or scan its QR code.
            </p>
          </div>
          {/* While the host restarts after enrolment it is "connecting"; only a lost host needs the cashier. */}
          {host === "disconnected" && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Cannot reach the register host</AlertTitle>
              <AlertDescription>
                <p>Start the register host, then reconnect.</p>
                <Button
                  aria-keyshortcuts="Alt+C"
                  className="mt-3"
                  onClick={onReconnect}
                  size="touch"
                  variant="outline"
                >
                  Reconnect <Kbd className="max-sm:hidden">Alt+C</Kbd>
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <EnrolServerPanel disabled={host !== "connected"} onChange={onServer} server={server} />
          <EnrolForm disabled={host !== "connected"} onSubmit={onSubmit} />
        </div>
      </main>
    </div>
  );
}
