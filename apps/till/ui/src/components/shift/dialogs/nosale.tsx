import { useState } from "react";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { useDialogSubmit } from "../../../hooks/shift/dialog/submit";
import type { SaleOutcome } from "../../../sale/types";
import { DialogFrame } from "./frame";

/** Opening the drawer with no sale. It is recorded with who did it, so the reason is required. */
export function NoSaleForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (reason: string) => Promise<SaleOutcome>;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const text = reason.trim();
  const form = useDialogSubmit(text !== "", () => onSubmit(text), onDone);
  return (
    <form className="grid gap-4" noValidate onSubmit={form.onSubmit} ref={form.shortcuts}>
      <DialogFrame
        action="Open drawer"
        block={text ? null : "Say why the drawer is opening"}
        description="Opening the drawer with no sale is recorded with your name and this reason."
        onCancel={onDone}
        pending={form.pending}
        problem={form.problem}
        title="No sale"
      >
        <Field>
          <FieldLabel htmlFor="nosale-reason">Reason</FieldLabel>
          <Input
            autoComplete="off"
            autoFocus
            id="nosale-reason"
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
