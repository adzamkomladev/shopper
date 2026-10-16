import { useState } from "react";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Textarea } from "@shopper/ui/components/textarea";

export function VoidDialog({
  open,
  onOpenChange,
  onReturnFocus,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="void-sale-help"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Void sale</DialogTitle>
          <DialogDescription id="void-sale-help">
            Record why this sale is being voided.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-sm font-medium">
          Reason
          <Textarea
            autoFocus
            className="min-h-24"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => onSubmit(reason.trim())}
            size="touch"
          >
            Void sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
