import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";

type Props = {
  children: React.ReactNode;
  onSubmit: () => void;
  onBack?: () => void;
  /** The primary button's words: Continue, or Install on the last step. */
  action: string;
  pending?: boolean;
  error?: string;
};

/** A first-boot step's form chrome: its fields, an error from the box, Back and the primary action. */
export function InstallStep({ children, onSubmit, onBack, action, pending, error }: Props) {
  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {onBack ? (
          <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={pending}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {pending ? "Installing…" : action}
        </Button>
      </div>
    </form>
  );
}
