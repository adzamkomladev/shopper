import { Dialog, DialogContent } from "@shopper/ui/components/dialog";
import { useAccountPayment } from "../../hooks/accounts/payment";
import type { PaymentActions } from "../../sale/account/types";
import { displayName } from "../../sale/customers";
import { DialogFrame } from "../shift/dialogs/frame";
import { FindCustomer } from "./find";
import { TakePayment } from "./take";

/** Take account payment (Alt+A): cash or MoMo against what a customer owes, with a slip. */
export function AccountPaymentDialog({
  open,
  actions,
  online,
  onClose,
  onClosed,
}: {
  open: boolean;
  actions: PaymentActions;
  /** MoMo and the balance need the server; cash is taken without it. */
  online: boolean;
  onClose: () => void;
  /** Puts focus back where the cashier was; the dialog has no trigger to do it. */
  onClosed: (event: Event) => void;
}) {
  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent onCloseAutoFocus={onClosed} showCloseButton={false}>
        <PaymentForm actions={actions} onDone={onClose} online={online} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog, so closing it drops the number and the amount. */
function PaymentForm({
  actions,
  online,
  onDone,
}: {
  actions: PaymentActions;
  online: boolean;
  onDone: () => void;
}) {
  const form = useAccountPayment({ actions, online, onDone });
  const { customer, customers, lookup } = form;
  const chosen = customers[form.active];
  return (
    <form className="grid gap-4" noValidate onSubmit={form.onSubmit} ref={form.shortcuts}>
      <DialogFrame
        action={customer ? "Take payment" : chosen ? `Use ${displayName(chosen)}` : "Find customer"}
        block={form.block}
        description="Find the customer by phone, then take cash or MoMo against what they owe."
        onCancel={onDone}
        pending={form.pending}
        problem={form.failure ?? (lookup?.status === "failed" ? lookup.message : null)}
        title="Take account payment"
      >
        {customer ? <TakePayment customer={customer} form={form} /> : <FindCustomer form={form} />}
      </DialogFrame>
    </form>
  );
}
