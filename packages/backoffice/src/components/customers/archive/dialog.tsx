import { refusal } from "../../../lib/customers/refusals";
import { useCustomerStatus } from "../../../queries/customers/status";
import type { CustomerView } from "../../../queries/customers/types";
import { ConfirmDialog } from "../../admin/confirm/dialog";

type Props = {
  customer: CustomerView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Asks before taking a customer off the till. The API's refusal (still owing, holding points) stays in the dialog. */
export function ArchiveDialog({ customer, open, onOpenChange, restoreFocus }: Props) {
  const archive = useCustomerStatus(customer.id, "archive", () => onOpenChange(false));
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) archive.reset();
        onOpenChange(next);
      }}
      title={`Archive ${customer.name}?`}
      description="They leave the till and the customer list. Their history stays, and you can restore them later."
      confirmLabel="Archive"
      error={archive.error ? refusal(archive.error) : undefined}
      pending={archive.isPending}
      onConfirm={() => archive.mutate()}
      restoreFocus={restoreFocus}
    />
  );
}
