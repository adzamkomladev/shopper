import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { FieldGroup } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { MOD_KEY } from "../../../lib/mod/key";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  title: string;
  description: string;
  /** The form, which mounts when the dialog opens and so starts empty each time. */
  children: React.ReactNode;
};

/** A dialog for one change to an account; focus goes back to the button that opened it. */
export function AccountDialog({
  open,
  onOpenChange,
  restoreFocus,
  title,
  description,
  children,
}: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

const OFFLINE_NOTE_ID = "account-offline-note";

type FormProps = {
  onSubmit: () => void;
  label: string;
  pending: boolean;
  /** What the server refused with. */
  error?: string;
  children: React.ReactNode;
};

/** The fields, what went wrong, and Cancel with the one submit button; Mod+Enter submits. */
export function AccountForm({ onSubmit, label, pending, error, children }: FormProps) {
  const online = useOnline();
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !pending) onSubmit();
    },
  });
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FieldGroup>{children}</FieldGroup>
      {!online && (
        <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
          You're offline. Reconnect to save.
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={!online || pending}
          aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
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
      </DialogFooter>
    </form>
  );
}
