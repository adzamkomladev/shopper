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
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { MOD_KEY } from "../../../lib/mod/key";

const BLOCKED_ID = "confirm-blocked";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Why the action can't go ahead (for example, records still use it). Disables the button. */
  blocked?: string;
  /** What the server said when the last attempt failed. */
  error?: string;
  pending: boolean;
  destructive?: boolean;
  /** More to read or choose before confirming, between the description and the buttons. */
  children?: React.ReactNode;
  onConfirm: () => void;
  restoreFocus: () => void;
};

/** Asks before something that can't be undone. Escape cancels; Mod+Enter confirms. */
export function ConfirmDialog(props: Props) {
  const { open, onOpenChange, title, description, confirmLabel, blocked, error, pending } = props;
  const online = useOnline();
  const canConfirm = online && !pending && !blocked;
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (canConfirm) props.onConfirm();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          props.restoreFocus();
        }}
      >
        {/* The shortcut map hangs on our own element: a ref given to Radix's DialogContent is not re-attached when it changes, so Mod+Enter would keep the first render's props. */}
        <div ref={shortcuts} className="contents">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {props.children}
          {blocked && (
            <p id={BLOCKED_ID} className="text-sm text-muted-foreground">
              {blocked}
            </p>
          )}
          {!online && (
            <p className="text-sm text-muted-foreground">You're offline. Reconnect to continue.</p>
          )}
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant={props.destructive === false ? "default" : "destructive"}
              disabled={!canConfirm}
              aria-describedby={blocked ? BLOCKED_ID : undefined}
              onClick={props.onConfirm}
            >
              {pending ? "Working…" : confirmLabel}
              {!pending && <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
