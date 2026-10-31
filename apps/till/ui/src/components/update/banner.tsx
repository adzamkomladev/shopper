import { Download } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import type { UpdateStatus } from "@shopper/sync/bridge";

/** In the shell: a required update waits for this shift to close; an optional one installs on the next restart. */
export function UpdateBanner({ update }: { update: UpdateStatus | undefined }) {
  const version = update?.version ?? update?.minVersion;
  const text = update?.required
    ? `Update required. Close this shift to install version ${version}.`
    : update?.state === "ready"
      ? `Version ${version} installs when this register next restarts.`
      : null;
  if (!text) return null;
  return (
    <Alert role="status" className="mx-4 mt-2 w-auto sm:mx-8">
      <Download aria-hidden="true" />
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}
