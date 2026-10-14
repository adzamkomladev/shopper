import { ConfirmDialog } from "../../admin/confirm/dialog";
import type { StoreView } from "../../../schemas/management";
import { deleteMessage, useDeleteStore } from "../../../queries/stores";

type Props = {
  store?: StoreView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many branches still belong to the store; null when this role can't see branches. */
  branchCount: number | null;
  restoreFocus: () => void;
};

export function DeleteStoreDialog({ store, open, onOpenChange, branchCount, restoreFocus }: Props) {
  const remove = useDeleteStore(() => onOpenChange(false));
  const name = store?.name ?? "this store";
  const blocked =
    branchCount && branchCount > 0
      ? `${name} still has ${branchCount} ${branchCount === 1 ? "branch" : "branches"}. Delete or move ${branchCount === 1 ? "it" : "them"} first.`
      : undefined;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title={`Delete ${name}?`}
      description="This removes the store. It can't be undone."
      confirmLabel="Delete store"
      blocked={blocked}
      error={remove.error ? deleteMessage(remove.error, name) : undefined}
      pending={remove.isPending}
      onConfirm={() => store && remove.mutate(store)}
      restoreFocus={restoreFocus}
    />
  );
}
