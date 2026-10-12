import { ConfirmDialog } from "../../components/admin/confirm-dialog";
import { useRevokeDevice, type DeviceView } from "./queries";

type Props = {
  device?: DeviceView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

export function RevokeDeviceDialog({ device, open, onOpenChange, restoreFocus }: Props) {
  const revoke = useRevokeDevice(() => onOpenChange(false));
  const name = device?.name ?? "this device";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) revoke.reset();
        onOpenChange(next);
      }}
      title={`Revoke ${name}?`}
      description="This device can no longer sign in cashiers. Enrol it again to bring it back."
      confirmLabel="Revoke device"
      error={revoke.error?.message}
      pending={revoke.isPending}
      onConfirm={() => device && revoke.mutate(device)}
      restoreFocus={restoreFocus}
    />
  );
}
