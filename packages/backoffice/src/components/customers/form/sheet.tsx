import type { CustomerView } from "../../../queries/customers/types";
import { FormSheet } from "../../admin/form/sheet";
import { CustomerForm } from "./form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  /** The customer being edited; absent when adding one. */
  customer?: CustomerView;
};

/** The sheet that adds a customer or edits one, and hands focus back when it closes. */
export function CustomerSheet({ open, onOpenChange, restoreFocus, customer }: Props) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? "Edit customer" : "New customer"}
      description={
        customer
          ? "Change their details. Clear a field to remove it."
          : "Name and phone are enough. Add a business name and TIN for a business."
      }
      restoreFocus={restoreFocus}
    >
      <CustomerForm
        key={customer?.id ?? "new"}
        customer={customer}
        onSaved={() => onOpenChange(false)}
      />
    </FormSheet>
  );
}
