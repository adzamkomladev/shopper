import { useForm } from "@tanstack/react-form";
import * as v from "valibot";
import { FieldError } from "@shopper/ui/components/field";
import { useCustomerFinder } from "../../../hooks/customers/finder";
import { focusFirstInvalid } from "../../../lib/focus";
import { refusal } from "../../../lib/customers/refusals";
import { useTransferPoints } from "../../../queries/customers/credit";
import type { CustomerView } from "../../../queries/customers/types";
import { emptyTransfer, transferSchema } from "../../../schemas/customers/credit";
import { TextField } from "../../fields/text";
import { MergePicker } from "../merge/picker";
import { AccountDialog, AccountForm } from "./shell";

type Props = {
  customer: CustomerView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Moves points to another customer: find them by phone or name, say how many and why. */
export function TransferDialog({ customer, ...dialog }: Props) {
  return (
    <AccountDialog
      {...dialog}
      title="Transfer points"
      description={`Move some of ${customer.name}'s points to another customer. Both balances change and the reason is kept.`}
    >
      <TransferForm customer={customer} onSaved={() => dialog.onOpenChange(false)} />
    </AccountDialog>
  );
}

function TransferForm({ customer, onSaved }: { customer: CustomerView; onSaved: () => void }) {
  const finder = useCustomerFinder(true, customer.id);
  const save = useTransferPoints(onSaved);
  const schema = transferSchema(customer.points);
  const form = useForm({
    defaultValues: emptyTransfer,
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => save.mutate({ fromId: customer.id, ...v.parse(schema, value) }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const clearError = () => save.isError && save.reset();
  return (
    <AccountForm
      onSubmit={() => void form.handleSubmit()}
      label="Transfer points"
      pending={save.isPending}
      error={save.error ? refusal(save.error) : undefined}
    >
      <form.Field name="toId">
        {(field) => (
          <div id={field.name} tabIndex={-1} className="flex flex-col gap-2 outline-none">
            <MergePicker
              {...finder}
              label="Find who receives the points"
              onTextChange={(text) => {
                finder.onTextChange(text);
                field.handleChange("");
              }}
              onChoose={(chosen) => {
                finder.onChoose(chosen);
                field.handleChange(chosen.id);
              }}
            />
            {field.state.meta.errors[0] && (
              <FieldError>{field.state.meta.errors[0].message}</FieldError>
            )}
          </div>
        )}
      </form.Field>
      <form.Field name="points">
        {(field) => (
          <TextField
            field={field}
            label="Points"
            description={`${customer.points} available.`}
            inputMode="numeric"
            autoComplete="off"
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
