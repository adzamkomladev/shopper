import { WifiOffIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { useOnline } from "@shopper/ui/hooks/use-online";

export function OfflineBanner() {
  if (useOnline()) return null;
  return (
    <Alert role="status" className="fixed inset-x-5 bottom-5 z-40 mx-auto max-w-2xl shadow-md">
      <WifiOffIcon aria-hidden />
      <AlertDescription>
        You're offline. You can still look around, but changes can't be saved until you're back
        online.
      </AlertDescription>
    </Alert>
  );
}
