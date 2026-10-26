import { ConfirmDialog } from "../../admin/confirm/dialog";
import { useMemberStatus, type StatusChange } from "../../../queries/users";

type Props = {
  change?: StatusChange;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

const COPY = {
  deactivate: {
    label: "Deactivate",
    description:
      "They are signed out everywhere and can’t sign in to the portal or a register. Registers drop them at their next sync. Their past sales and records stay.",
  },
  reactivate: {
    label: "Reactivate",
    description: "They can sign in again with the role and branches they had.",
  },
};

/** Confirms deactivating or reactivating a member. */
export function MemberStatusDialog({ change, open, onOpenChange, restoreFocus }: Props) {
  const status = useMemberStatus(() => onOpenChange(false));
  const copy = COPY[change?.action ?? "deactivate"];
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) status.reset();
        onOpenChange(next);
      }}
      title={`${copy.label} ${change?.member.name ?? "this member"}?`}
      description={copy.description}
      confirmLabel={copy.label}
      destructive={change?.action === "deactivate"}
      error={status.error?.message}
      pending={status.isPending}
      onConfirm={() => change && status.mutate(change)}
      restoreFocus={restoreFocus}
    />
  );
}
