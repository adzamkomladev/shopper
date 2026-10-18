import { CircleAlert, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { HostConnection } from "../../connection/types";
import type { SignInFailure } from "../../session/types";

const titles = {
  INVALID_CREDENTIALS: "Wrong email or password",
  SIGN_IN_LOCKED: "Sign-in is locked",
  OFFLINE_UNAVAILABLE: "Connect to the internet to sign in",
  DEVICE_REJECTED: "This register needs to be enrolled again",
  SIGN_IN_UNAVAILABLE: "Sign-in is unavailable",
  HOST_UNREACHABLE: "Cannot reach the register host",
  OTHER: "Sign-in is unavailable",
} as const;

const details = {
  INVALID_CREDENTIALS: "Check them and try again.",
  OFFLINE_UNAVAILABLE:
    "This register has no recent sign-in for that email. Connect it to the internet, then try again.",
  DEVICE_REJECTED: "Ask a manager to enrol this register again from the portal.",
} as const;

/** What the sign-in form tells the cashier: the host being unreachable, the last failure, or the offline notice. */
export function SignInNotices({
  host,
  offline,
  failure,
  onReconnect,
}: {
  host: HostConnection;
  offline: boolean;
  failure: SignInFailure | null;
  onReconnect: () => void;
}) {
  const unreachable = host !== "connected";
  const shown = unreachable
    ? ({
        code: "HOST_UNREACHABLE",
        message: "Start the register host, then reconnect.",
      } satisfies SignInFailure)
    : failure;
  return (
    <>
      {offline && !unreachable && (
        <Alert role="status">
          <WifiOff aria-hidden="true" />
          <AlertTitle>You are offline</AlertTitle>
          <AlertDescription>
            You can still sign in if you signed in on this register in the last 7 days.
          </AlertDescription>
        </Alert>
      )}
      {shown && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{titles[shown.code]}</AlertTitle>
          <AlertDescription>
            <p>
              {shown.code in details ? details[shown.code as keyof typeof details] : shown.message}
            </p>
            {unreachable && (
              <Button
                aria-keyshortcuts="Alt+C"
                className="mt-3"
                disabled={host === "connecting"}
                onClick={onReconnect}
                size="touch"
                variant="outline"
              >
                {host === "connecting" ? "Connecting…" : "Reconnect"}{" "}
                <Kbd className="max-sm:hidden">Alt+C</Kbd>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
