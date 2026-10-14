import { ConfirmDialog } from "../../admin/confirm/dialog";
import { useCancelInvitation, type InvitationView } from "../../../queries/users";

type Props = {
  invitation?: InvitationView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

export function CancelInvitationDialog({ invitation, open, onOpenChange, restoreFocus }: Props) {
  const cancel = useCancelInvitation(() => onOpenChange(false));
  const email = invitation?.email ?? "this invitation";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cancel.reset();
        onOpenChange(next);
      }}
      title={`Cancel invitation for ${email}?`}
      description="The link stops working straight away. You can invite them again later."
      confirmLabel="Cancel invitation"
      error={cancel.error?.message}
      pending={cancel.isPending}
      onConfirm={() => invitation && cancel.mutate(invitation)}
      restoreFocus={restoreFocus}
    />
  );
}
