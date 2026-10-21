import { useState } from "react";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { useDialogSubmit } from "../../../hooks/shift/dialog/submit";
import { cedisText, parseCedis } from "../../../shift/amount";
import type { SaleOutcome } from "../../../sale/types";
import { DialogFrame } from "./frame";

/** Cash taken out of the drawer for the safe or the bank. The register opens the drawer when it is saved. */
export function DropForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (amount: number, reason?: string) => Promise<SaleOutcome>;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const value = parseCedis(amount);
  const ready = value !== null && value > 0;
  const form = useDialogSubmit(ready, () => onSubmit(value!, reason.trim() || undefined), onDone);
  return (
    <form className="grid gap-4" noValidate onSubmit={form.onSubmit} ref={form.shortcuts}>
      <DialogFrame
        action="Record drop"
        block={ready ? null : "Enter the amount taken out, more than GH₵ 0.00"}
        description="Record cash taken out of the drawer. The drawer opens when you save."
        onCancel={onDone}
        pending={form.pending}
        problem={form.problem}
        title="Cash drop"
      >
        <Field>
          <FieldLabel htmlFor="drop-amount">Amount (GH₵)</FieldLabel>
          <Input
            autoComplete="off"
            autoFocus
            id="drop-amount"
            inputMode="decimal"
            onChange={(event) => setAmount(cedisText(event.target.value))}
            touch
            value={amount}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="drop-reason">Reason (optional)</FieldLabel>
          <Input
            autoComplete="off"
            id="drop-reason"
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            touch
            value={reason}
          />
        </Field>
      </DialogFrame>
    </form>
  );
}
