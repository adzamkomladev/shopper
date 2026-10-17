import { CircleAlert, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { SaveError } from "../../settings/types";
import { modLabel } from "@shopper/ui/hooks/modkey";
import { readOnlyReason } from "./devices";

/** Why the screen cannot save right now: read-only, edited elsewhere, or the host could not store it. */
export function SettingsNotice({
  error,
  stale,
  readOnly,
  onReload,
  onRetry,
}: {
  error: SaveError | null;
  stale: boolean;
  readOnly: boolean;
  onReload: () => void;
  onRetry: () => void;
}) {
  if (stale)
    return (
      <Alert id="settings-notice" variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Settings changed on another screen</AlertTitle>
        <AlertDescription>
          <p>Reload to see the latest settings. Edits on this screen will be discarded.</p>
          <Button
            aria-keyshortcuts="Alt+L"
            className="text-foreground"
            onClick={onReload}
            size="touch"
            type="button"
            variant="outline"
          >
            Reload settings <Kbd className="max-sm:hidden">Alt+L</Kbd>
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (error?.kind === "storage")
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Settings could not be saved</AlertTitle>
        <AlertDescription>
          <p>{error.message}</p>
          <Button
            className="text-foreground"
            onClick={onRetry}
            size="touch"
            type="button"
            variant="outline"
          >
            Retry <Kbd className="max-sm:hidden">{modLabel("S")}</Kbd>
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (readOnly || error?.kind === "permission")
    return (
      <Alert role="note">
        <Lock aria-hidden="true" />
        <AlertTitle>You can view these settings but not change them</AlertTitle>
        <AlertDescription>
          <p>{readOnlyReason}.</p>
        </AlertDescription>
      </Alert>
    );
  return null;
}
