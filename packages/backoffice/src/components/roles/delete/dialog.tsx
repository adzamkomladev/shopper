import { useRef, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ConfirmDialog } from "../../admin/confirm/dialog";
import { MOD_KEY } from "../../../lib/mod/key";
import { roleLabel, useDeleteRole, type RoleView } from "../../../queries/roles";

const REASON_ID = "delete-role-reason";

type Props = { role: RoleView; onDeleted: () => void };

/** Deletes a role nobody holds, after a confirmation (Mod+Shift+Backspace). The server also refuses one an invitation names. */
export function DeleteRole({ role, onDeleted }: Props) {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const remove = useDeleteRole(role, () => {
    setOpen(false);
    onDeleted();
  });
  const held = role.memberCount;
  const blocked =
    held > 0
      ? `${held} ${held === 1 ? "member holds it" : "members hold it"}. Give them another role first.`
      : undefined;
  const shortcuts = useShortcuts({
    "Mod+Shift+Backspace": () => !blocked && online && setOpen(true),
  });
  return (
    <div ref={shortcuts} className="flex flex-col gap-2 border-t pt-4">
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        className="self-start text-destructive"
        disabled={!!blocked || !online}
        aria-describedby={blocked ? REASON_ID : undefined}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden />
        Delete role
        <Kbd aria-hidden>{MOD_KEY}⇧⌫</Kbd>
      </Button>
      {blocked && (
        <p id={REASON_ID} className="text-sm text-muted-foreground">
          {blocked}
        </p>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) remove.reset();
          setOpen(next);
        }}
        title={`Delete ${roleLabel(role)}?`}
        description="Nobody can be given this role again. Its history stays in the audit log."
        confirmLabel="Delete role"
        destructive
        error={remove.error?.message}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        restoreFocus={() => trigger.current?.focus()}
      />
    </div>
  );
}
