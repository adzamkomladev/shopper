import { useState } from "react";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { ConfirmDialog } from "../../admin/confirm/dialog";
import { useMoveStart } from "../../../queries/migration/move";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The address a failed move used, offered again. */
  cloudUrl?: string;
  restoreFocus: () => void;
};

/** The last check before the box hands its shop over: where to, and the word typed out. */
export function MoveDialog({ open, onOpenChange, cloudUrl, restoreFocus }: Props) {
  const start = useMoveStart();
  const [address, setAddress] = useState(cloudUrl ?? "");
  const [typed, setTyped] = useState("");
  const ready = /^https:\/\/[^\s/]+/.test(address.trim()) && typed.trim() === "MOVE";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) start.reset();
        onOpenChange(next);
      }}
      title="Move this shop to the cloud?"
      description="From now on this box only reads. Tills keep selling, then follow the shop to the cloud the next time they connect. This can't be undone from here."
      confirmLabel="Move now"
      blocked={ready ? undefined : "Enter the cloud address and type MOVE to continue."}
      error={start.error?.message}
      pending={start.isPending}
      destructive={false}
      onConfirm={() => start.mutate(address.trim(), { onSuccess: () => onOpenChange(false) })}
      restoreFocus={restoreFocus}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="move-cloud">Cloud address</FieldLabel>
          <Input
            id="move-cloud"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <FieldDescription>The address Shopper gave you for your cloud shop.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="move-word">Type MOVE to confirm</FieldLabel>
          <Input
            id="move-word"
            autoComplete="off"
            autoCapitalize="characters"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </Field>
      </FieldGroup>
    </ConfirmDialog>
  );
}
