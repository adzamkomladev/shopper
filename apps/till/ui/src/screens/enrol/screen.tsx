import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { EnrolForm } from "../../components/enrol/form";
import { TitleBar } from "../../components/shell/titlebar";
import type { HostConnection } from "../../connection/types";
import type { EnrolOutcome } from "../../enrol/types";
import type { EnrolInput } from "../../schemas/enrol";

/**
 * Figma "New Login", for a till fresh from the installer: the app name, what to do, and the codes the portal
 * shows when the owner creates one. It reports the attempt through `onSubmit`.
 */
export function EnrolScreen({
  host,
  onSubmit,
  onReconnect,
}: {
  host: HostConnection;
  onSubmit: (input: EnrolInput) => Promise<EnrolOutcome>;
  onReconnect: () => void;
}) {
  const register = useShortcuts({ "Alt+C": onReconnect });
  return (
    <div className="flex h-svh min-h-0 flex-col bg-background" ref={register}>
      <TitleBar />
      <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-8">
        <div className="grid w-full max-w-xl gap-8">
          <div className="grid gap-3 text-center">
            <h1 className="text-4xl font-semibold tracking-tight">Set up this till</h1>
            <p className="text-base font-medium text-muted-foreground">
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
          <EnrolForm disabled={host !== "connected"} onSubmit={onSubmit} />
        </div>
      </main>
    </div>
  );
}
