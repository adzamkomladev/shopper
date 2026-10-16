import { useState } from "react";
import { formatGHS, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Input } from "@shopper/ui/components/input/control";

export function CardDialog({
  open,
  amount,
  onOpenChange,
  onReturnFocus,
  onSubmit,
}: {
  open: boolean;
  amount: Money;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
  onSubmit: (approvalCode: string, last4: string) => void;
}) {
  const [approval, setApproval] = useState("");
  const [last4, setLast4] = useState("");
  const approvalValue = approval.trim();
  const approvalIsValid = /^[a-zA-Z0-9]{4,12}$/.test(approvalValue);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="card-payment-help"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Card payment</DialogTitle>
          <DialogDescription id="card-payment-help">
            Confirm the terminal approval before recording this tender.
          </DialogDescription>
        </DialogHeader>
        <p className="text-2xl font-semibold tabular-nums">{formatGHS(amount)}</p>
        <label className="grid gap-2 text-sm font-medium">
          Approval code
          <Input
            aria-describedby="card-approval-format"
            aria-invalid={approval.length > 0 && !approvalIsValid}
            autoFocus
            maxLength={12}
            touch
            value={approval}
            onChange={(event) => setApproval(event.target.value)}
          />
        </label>
        <p className="-mt-2 text-sm text-muted-foreground" id="card-approval-format">
          Use 4–12 letters or numbers (A–Z, 0–9).
        </p>
        <label className="grid gap-2 text-sm font-medium">
          Card last four digits
          <Input
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            touch
            value={last4}
            onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <DialogFooter>
          <Button
            disabled={!approvalIsValid || (last4 !== "" && last4.length !== 4)}
            onClick={() => onSubmit(approvalValue, last4)}
            size="touch"
          >
            Add card tender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
