import { ConfirmDialog } from "../../admin/confirm/dialog";
import { ApiError } from "../../../api/client";
import { useDeleteBranch } from "../../../queries/branches";

type Props = {
  branch?: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

export function DeleteBranchDialog({ branch, open, onOpenChange, restoreFocus }: Props) {
  const remove = useDeleteBranch(() => onOpenChange(false));
  const name = branch?.name ?? "this branch";
  const error = remove.error;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title={`Delete ${name}?`}
      description="This removes the branch. It can't be undone."
      confirmLabel="Delete branch"
      error={
        error instanceof ApiError && error.status === 409
          ? `${name} is still used by tills or sales, so it can't be deleted.`
          : error?.message
      }
      pending={remove.isPending}
      onConfirm={() => branch && remove.mutate(branch)}
      restoreFocus={restoreFocus}
    />
  );
}
