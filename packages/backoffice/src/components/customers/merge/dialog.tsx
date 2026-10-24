import { useCustomerFinder } from "../../../hooks/customers/finder";
import { refusal } from "../../../lib/customers/refusals";
import { useMergeCustomers } from "../../../queries/customers/status";
import type { CustomerView } from "../../../queries/customers/types";
import { ConfirmDialog } from "../../admin/confirm/dialog";
import { MergePicker } from "./picker";
import { MergeResult } from "./result";

type Props = {
  /** The customer kept: the other one's account and points move to them. */
  keep: CustomerView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  /** What the search starts with: the shared phone number when the flag opened this, else empty. */
  initialText: string;
};

/** Finds the customer to fold in, shows both accounts and the result, and asks before merging. */
export function MergeDialog({ keep, open, onOpenChange, restoreFocus, initialText }: Props) {
  const finder = useCustomerFinder(open, keep.id, initialText);
  const merge = useMergeCustomers(keep.id, () => onOpenChange(false));
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) merge.reset();
        onOpenChange(next);
      }}
      title={`Merge into ${keep.name}`}
      description="Pick the customer to fold in. Their account and points move to this customer, and they are archived. A merge can't be undone."
      confirmLabel="Merge customers"
      blocked={finder.chosen ? undefined : "Pick the customer to merge in."}
      error={merge.error ? refusal(merge.error) : undefined}
      pending={merge.isPending}
      onConfirm={() => finder.chosen && merge.mutate(finder.chosen.id)}
      restoreFocus={restoreFocus}
    >
      <MergePicker label="Find the customer to merge in" {...finder} />
      {finder.chosen && <MergeResult keep={keep} fold={finder.chosen} />}
    </ConfirmDialog>
  );
}
