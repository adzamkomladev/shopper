import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { v7 } from "uuid";
import * as v from "valibot";
import { focusFirstInvalid } from "../../../lib/focus";
import { refusal } from "../../../lib/customers/refusals";
import { useRecordPayment } from "../../../queries/customers/credit";
import type { CustomerView } from "../../../queries/customers/types";
import { emptyPayment, paymentSchema } from "../../../schemas/customers/credit";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { AccountDialog, AccountForm } from "./shell";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "momo", label: "Mobile money" },
] as const;

type Props = {
  customer: CustomerView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Money paid onto the account, in cash or by MoMo. More than is owed becomes a deposit. */
export function PaymentDialog({ customer, ...dialog }: Props) {
  return (
    <AccountDialog
      {...dialog}
      title="Record a payment"
      description={`Money ${customer.name} paid towards their account. More than they owe is kept as a deposit.`}
    >
      <PaymentForm customer={customer} onSaved={() => dialog.onOpenChange(false)} />
    </AccountDialog>
  );
}

function PaymentForm({ customer, onSaved }: { customer: CustomerView; onSaved: () => void }) {
  // One id for the life of the form, so a retry after a dropped reply replays instead of counting twice.
  const [id] = useState(() => v7());
  const save = useRecordPayment(customer.id, onSaved);
  const form = useForm({
    defaultValues: emptyPayment,
    validators: { onSubmit: paymentSchema },
    onSubmit: ({ value }) => save.mutate({ id, ...v.parse(paymentSchema, value) }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const clearError = () => save.isError && save.reset();
  return (
    <AccountForm
      onSubmit={() => void form.handleSubmit()}
      label="Record payment"
      pending={save.isPending}
      error={save.error ? refusal(save.error) : undefined}
    >
      <form.Field name="amount">
        {(field) => (
          <TextField
            field={field}
            label="Amount"
            description="In cedis, for example 150.00."
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            onChange={clearError}
          />
        )}
      </form.Field>
      <form.Field name="method">
        {(field) => <SelectField field={field} label="Paid by" options={METHODS} />}
      </form.Field>
    </AccountForm>
  );
}
