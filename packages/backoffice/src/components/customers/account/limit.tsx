import { useForm } from "@tanstack/react-form";
import * as v from "valibot";
import { toDecimal } from "@shopper/money";
import { focusFirstInvalid } from "../../../lib/focus";
import { refusal } from "../../../lib/customers/refusals";
import { useSetCreditLimit } from "../../../queries/customers/credit";
import type { CustomerView } from "../../../queries/customers/types";
import { limitSchema } from "../../../schemas/customers/credit";
import { TextField } from "../../fields/text";
import { AccountDialog, AccountForm } from "./shell";

type Props = {
  customer: CustomerView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** The most they may owe on account. The server refuses a limit for a customer whose identity is not verified. */
export function LimitDialog({ customer, ...dialog }: Props) {
  return (
    <AccountDialog
      {...dialog}
      title="Set the credit limit"
      description={`The most ${customer.name} can owe on account. Set 0 to stop credit sales.`}
    >
      <LimitForm customer={customer} onSaved={() => dialog.onOpenChange(false)} />
    </AccountDialog>
  );
}

function LimitForm({ customer, onSaved }: { customer: CustomerView; onSaved: () => void }) {
  const save = useSetCreditLimit(customer.id, onSaved);
  const form = useForm({
    defaultValues: { creditLimit: toDecimal(customer.creditLimit) },
    validators: { onSubmit: limitSchema },
    onSubmit: ({ value }) => save.mutate(v.parse(limitSchema, value)),
    onSubmitInvalid: focusFirstInvalid,
  });
  const clearError = () => save.isError && save.reset();
  return (
    <AccountForm
      onSubmit={() => void form.handleSubmit()}
      label="Save limit"
      pending={save.isPending}
      error={save.error ? refusal(save.error) : undefined}
    >
      <form.Field name="creditLimit">
        {(field) => (
          <TextField
            field={field}
            label="Credit limit"
            description="In cedis, for example 500.00."
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            onChange={clearError}
          />
        )}
      </form.Field>
    </AccountForm>
  );
}
