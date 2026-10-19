import { Dialog, DialogContent } from "@shopper/ui/components/dialog";
import { toast } from "@shopper/ui/components/sonner";
import { formatGHS, money } from "@shopper/money";
import type { ShiftActions, ShiftDialog } from "../../../shift/types";
import { DropForm } from "./drop";
import { NoSaleForm } from "./nosale";
import { OpenForm } from "./open";

/** The three shift dialogs. Each stays mounted through its exit animation and drops its fields when it closes. */
export function ShiftDialogs({
  dialog,
  actions,
  onClose,
  onClosed,
}: {
  dialog: ShiftDialog | null;
  actions: ShiftActions;
  onClose: () => void;
  /** Puts focus back where the cashier was; the dialog has no trigger to do it. */
  onClosed: (event: Event) => void;
}) {
  const change = (open: boolean) => !open && onClose();
  return (
    <>
      <Dialog onOpenChange={change} open={dialog === "open"}>
        <DialogContent className="sm:max-w-xl" onCloseAutoFocus={onClosed} showCloseButton={false}>
          <OpenForm onDone={onClose} onSubmit={actions.open} />
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={change} open={dialog === "drop"}>
        <DialogContent onCloseAutoFocus={onClosed} showCloseButton={false}>
          <DropForm
            onDone={onClose}
            onSubmit={async (amount, reason) => {
              const outcome = await actions.drop(amount, reason);
              if (outcome.ok) toast.success(`Cash drop of ${formatGHS(money(amount))} recorded`);
              return outcome;
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={change} open={dialog === "nosale"}>
        <DialogContent onCloseAutoFocus={onClosed} showCloseButton={false}>
          <NoSaleForm
            onDone={onClose}
            onSubmit={async (reason) => {
              const outcome = await actions.noSale(reason);
              if (outcome.ok) toast.success("Drawer opened");
              return outcome;
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
