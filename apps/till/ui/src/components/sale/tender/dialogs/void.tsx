import { useState, type FormEvent } from "react";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { FieldError } from "@shopper/ui/components/field";
import { Textarea } from "@shopper/ui/components/textarea";
import { useApprovalForm } from "../../../../hooks/approval/form";
import type { Approval, ApproverState, SaleControls, SaleOutcome } from "../../../../sale/types";
import { ApprovalFields } from "../../../approval/fields";

const needsManager: Record<NonNullable<SaleControls["voidApproval"]>, string> = {
  cash: "Cash was taken. A manager must approve this void.",
  card: "A card payment was taken. A manager must approve this void.",
  permission: "A manager must approve this void.",
};

type Props = {
  open: boolean;
  /** Why a manager must approve, or null when the cashier may void alone. */
  approval: SaleControls["voidApproval"];
  approvers: ApproverState;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
  onRetryApprovers: () => void;
  onSubmit: (reason: string, approval?: Approval) => Promise<SaleOutcome>;
};

export function VoidDialog({ open, onOpenChange, onReturnFocus, ...form }: Props) {
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
        <VoidForm {...form} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog content, so closing the dialog drops the reason and the PIN. */
function VoidForm({
  approval,
  approvers,
  onRetryApprovers,
  onSubmit,
}: Omit<Props, "open" | "onOpenChange" | "onReturnFocus">) {
  const [reason, setReason] = useState("");
  const manager = useApprovalForm(approvers, approval !== null);
  const text = reason.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text) void manager.submit((approved) => onSubmit(text, approved));
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Void sale</DialogTitle>
        <DialogDescription id="void-sale-help">
          {approval ? needsManager[approval] : "Record why this sale is being voided."}
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
      {approval && (
        <ApprovalFields
          approvers={approvers}
          form={manager}
          onRetry={onRetryApprovers}
          permission="sale.void"
        />
      )}
      {manager.problem && <FieldError>{manager.problem}</FieldError>}
      <DialogFooter>
        <Button
          disabled={!text || !manager.ready || manager.pending}
          size="touch"
          type="submit"
          variant="destructive"
        >
          Void sale
        </Button>
      </DialogFooter>
    </form>
  );
}
