import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@shopper/ui/components/field";
import { DatePicker } from "@shopper/ui/components/picker/date";
import { useLock } from "../../../queries/ledger/books";
import { AccountDialog, AccountForm } from "../../customers/account/shell";

type Props = {
  lockedThrough: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Closes the books through a day: manual entries on or before it are refused, late synced activity posts the day after. */
export function LockDialog({ lockedThrough, ...dialog }: Props) {
  const [through, setThrough] = useState(lockedThrough ?? "");
  const lock = useLock(() => dialog.onOpenChange(false));
  return (
    <AccountDialog
      {...dialog}
      title="Lock the books"
      description="Lock a period once it is reported. Nothing can be posted on or before the lock date; a late offline sale counts on the first open day."
    >
      <AccountForm
        onSubmit={() => lock.mutate(through || null)}
        label={through ? `Lock through ${through}` : "Open the books"}
        pending={lock.isPending}
        error={lock.error?.message}
      >
        <Field>
          <FieldLabel htmlFor="ledger-lock-through">Locked through</FieldLabel>
          <DatePicker
            id="ledger-lock-through"
            value={through}
            onValueChange={(value) => setThrough(value ?? "")}
          />
          <FieldDescription>Clear the date to open every period again.</FieldDescription>
        </Field>
      </AccountForm>
    </AccountDialog>
  );
}
