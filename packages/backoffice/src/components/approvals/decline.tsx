import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Label } from "@shopper/ui/components/label";
import { Textarea } from "@shopper/ui/components/textarea";

type Props = {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onDecline: (reason?: string) => void;
  /** Where focus goes when it closes: the list, since the request it answered is gone. */
  restoreFocus: () => void;
};

/** Declining, with an optional reason the cashier sees at the till. */
export function DeclineDialog({ open, busy, onOpenChange, onDecline, restoreFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const typed = new FormData(event.currentTarget).get("reason");
            onDecline(typeof typed === "string" && typed.trim() ? typed.trim() : undefined);
          }}
        >
          <DialogHeader>
            <DialogTitle>Decline the request</DialogTitle>
            <DialogDescription>The cashier sees your reason at the till.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea id="decline-reason" name="reason" maxLength={500} rows={3} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Declining…" : "Decline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
