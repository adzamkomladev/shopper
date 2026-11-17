import { useState } from "react";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { ConfirmDialog } from "../../admin/confirm/dialog";
import { useOnPremCancel, useOnPremStart } from "../../../queries/migration/onprem";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; restoreFocus: () => void };

/** The last check before the cloud freezes: the word typed out. */
export function StartDialog({ open, onOpenChange, restoreFocus }: Props) {
  const start = useOnPremStart();
  const [typed, setTyped] = useState("");
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) start.reset();
        onOpenChange(next);
      }}
      title="Move this shop onto its own box?"
      description="From now on the back office here only reads and tills stop sending sales until they move to the box. Do it after closing."
      confirmLabel="Start the move"
      blocked={typed.trim() === "MOVE" ? undefined : "Type MOVE to continue."}
      error={start.error?.message}
      pending={start.isPending}
      destructive={false}
      onConfirm={() => start.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
      restoreFocus={restoreFocus}
    >
      <Field>
        <FieldLabel htmlFor="onprem-word">Type MOVE to confirm</FieldLabel>
        <Input
          id="onprem-word"
          autoComplete="off"
          autoCapitalize="characters"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </Field>
    </ConfirmDialog>
  );
}

/** Calling the move off: the cloud takes changes again and the box's copy is left behind. */
export function CancelDialog({ open, onOpenChange, restoreFocus }: Props) {
  const cancel = useOnPremCancel();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cancel.reset();
        onOpenChange(next);
      }}
      title="Call the move off?"
      description="The shop trades in the cloud again from now. Anything a box already imported stays on that box; reinstall it before you try again."
      confirmLabel="Call it off"
      error={cancel.error?.message}
      pending={cancel.isPending}
      onConfirm={() => cancel.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
      restoreFocus={restoreFocus}
    />
  );
}
