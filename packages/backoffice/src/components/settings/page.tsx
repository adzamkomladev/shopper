import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { MOD_KEY } from "../../lib/mod/key";
import { focusIfIdle } from "../../lib/focus";

type PageProps = { title: string; description: string; children: React.ReactNode };

/** The heading and a line on what the settings do; the form (and anything under it) is `children`. */
export function SettingsPage({ title, description, children }: PageProps) {
  return (
    <div className="flex max-w-2xl flex-col gap-6 pb-6">
      <div className="flex flex-col gap-1">
        {/* Focused on arrival, so the screen's shortcuts work straight after navigating here. */}
        <h1
          tabIndex={-1}
          ref={focusIfIdle}
          className="text-3xl font-bold tracking-tight outline-none"
        >
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

type SaveProps = { label: string; pending: boolean; error?: string };

const OFFLINE_ID = "settings-offline";

/** The one Save button of a settings form, with what the server said if the last save failed. */
export function SaveBar({ label, pending, error }: SaveProps) {
  const online = useOnline();
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!online && (
        <p id={OFFLINE_ID} role="status" className="text-sm text-muted-foreground">
          You're offline. Reconnect to save.
        </p>
      )}
      <Button
        type="submit"
        className="self-start"
        disabled={!online || pending}
        aria-describedby={online ? undefined : OFFLINE_ID}
      >
        {pending ? (
          "Saving…"
        ) : (
          <>
            {label}
            <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
          </>
        )}
      </Button>
    </div>
  );
}
