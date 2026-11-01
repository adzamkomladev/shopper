import type { FormEvent } from "react";
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
import { Kbd } from "@shopper/ui/components/kbd";
import { useApprovalForm } from "../../hooks/approval/form";
import type { Approval, ApproverState, SaleOutcome } from "../../sale/types";
import { ApprovalFields } from "../approval/fields";

type Props = {
  open: boolean;
  /** The locked account, as the cashier typed it. */
  email: string;
  approvers: ApproverState;
  onOpenChange: (open: boolean) => void;
  onRetryApprovers: () => void;
  onSubmit: (approval: Approval) => Promise<SaleOutcome>;
};

export const unlockButtonId = "signin-unlock";
const unlockButton = () => document.getElementById(unlockButtonId);

/** A manager chooses themself and types their PIN to lift a cashier's sign-in lock. */
export function UnlockDialog({ open, onOpenChange, ...form }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="unlock-help"
        // No trigger to return to: back to the unlock button, or to signing in once the lock is gone.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (unlockButton() ?? document.getElementById("signin-email"))?.focus();
        }}
        showCloseButton={false}
      >
        <UnlockForm {...form} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog content, so closing the dialog drops the PIN. */
function UnlockForm({
  email,
  approvers,
  onRetryApprovers,
  onSubmit,
  onCancel,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const manager = useApprovalForm(approvers, true);

  function submit(event: FormEvent) {
    event.preventDefault();
    void manager.submit((approval) => onSubmit(approval!));
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Unlock sign-in</DialogTitle>
        <DialogDescription id="unlock-help">
          A manager’s PIN lets {email} try again now. Their password stays the same.
        </DialogDescription>
      </DialogHeader>
      <ApprovalFields
        approvers={approvers}
        form={manager}
        onRetry={onRetryApprovers}
        permission="staff.unlock"
      />
      {manager.problem && <FieldError>{manager.problem}</FieldError>}
      <DialogFooter>
        <Button
          aria-keyshortcuts="Escape"
          onClick={onCancel}
          size="touch"
          type="button"
          variant="outline"
        >
          Cancel <Kbd>Esc</Kbd>
        </Button>
        <Button
          aria-keyshortcuts="Enter"
          disabled={!manager.ready || manager.pending}
          size="touch"
          type="submit"
        >
          {manager.pending ? "Unlocking…" : "Unlock"} <Kbd>Enter</Kbd>
        </Button>
      </DialogFooter>
    </form>
  );
}
