import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@shopper/ui/components/field";
import { DatePicker } from "@shopper/ui/components/picker/date";
import { shopToday } from "../../../lib/tax/dates";
import { useReverseEntry } from "../../../queries/ledger/books";
import type { JournalEntryView } from "../../../schemas/ledger/views";
import { AccountDialog, AccountForm } from "../../customers/account/shell";

type Props = {
  entry: JournalEntryView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Posts the mirror of an entry on an open day; the original stays as it was, and an entry is reversed once. */
export function ReverseDialog({ entry, ...dialog }: Props) {
  const [postedOn, setPostedOn] = useState(shopToday());
  const reverse = useReverseEntry(() => dialog.onOpenChange(false));
  return (
    <AccountDialog
      {...dialog}
      title={`Reverse "${entry.memo}"?`}
      description={`Every line of the entry of ${entry.postedOn} posts again on the other side. Use it to undo a mistake, then post the right entry.`}
    >
      <AccountForm
        onSubmit={() => reverse.mutate({ id: entry.id, postedOn })}
        label="Reverse entry"
        pending={reverse.isPending}
        error={reverse.error?.message}
      >
        <Field>
          <FieldLabel htmlFor="reverse-day">Reverse on</FieldLabel>
          <DatePicker
            id="reverse-day"
            value={postedOn}
            onValueChange={(value) => value && setPostedOn(value)}
          />
          <FieldDescription>An open day, after the lock date.</FieldDescription>
        </Field>
      </AccountForm>
    </AccountDialog>
  );
}
