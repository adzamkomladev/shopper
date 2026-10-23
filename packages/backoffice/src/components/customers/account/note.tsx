import { useForm } from "@tanstack/react-form";
import * as v from "valibot";
import { focusFirstInvalid } from "../../../lib/focus";
import { refusal } from "../../../lib/customers/refusals";
import { useAddCreditNote } from "../../../queries/customers/credit";
import type { CustomerView } from "../../../queries/customers/types";
import { emptyNote, noteSchema } from "../../../schemas/customers/credit";
import { TextField } from "../../fields/text";
import { AccountDialog, AccountForm } from "./shell";

type Props = {
  customer: CustomerView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Takes an amount off what they owe without a payment: a goodwill discount or a correction, with the reason kept. */
export function CreditNoteDialog({ customer, ...dialog }: Props) {
  return (
    <AccountDialog
      {...dialog}
      title="Add a credit note"
      description={`Lowers what ${customer.name} owes without a payment. The reason is kept with the entry.`}
    >
      <CreditNoteForm customer={customer} onSaved={() => dialog.onOpenChange(false)} />
    </AccountDialog>
  );
}

function CreditNoteForm({ customer, onSaved }: { customer: CustomerView; onSaved: () => void }) {
  const save = useAddCreditNote(customer.id, onSaved);
  const form = useForm({
    defaultValues: emptyNote,
    validators: { onSubmit: noteSchema },
    onSubmit: ({ value }) => save.mutate(v.parse(noteSchema, value)),
    onSubmitInvalid: focusFirstInvalid,
  });
  const clearError = () => save.isError && save.reset();
  return (
    <AccountForm
      onSubmit={() => void form.handleSubmit()}
      label="Add credit note"
      pending={save.isPending}
      error={save.error ? refusal(save.error) : undefined}
    >
      <form.Field name="amount">
        {(field) => (
          <TextField
            field={field}
            label="Amount"
            description="In cedis, for example 20.00."
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            onChange={clearError}
          />
        )}
      </form.Field>
      <form.Field name="reason">
        {(field) => (
          <TextField
            field={field}
            label="Reason"
            autoComplete="off"
            maxLength={500}
            onChange={clearError}
          />
        )}
      </form.Field>
    </AccountForm>
  );
}
