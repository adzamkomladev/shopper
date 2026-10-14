import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { KeyRoundIcon, MonitorSmartphoneIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { FormSheet } from "../../components/admin/form/sheet";
import { PageHeader } from "../../components/admin/page/header";
import { deleteButtonId } from "../../components/admin/row/actions";
import { EmptyList } from "../../components/admin/states";
import { usePanel } from "../../hooks/admin/panel";
import { ApiError } from "../../api/client";
import { permissionsQuery } from "../../queries/session/permissions";
import { branchesQuery } from "../../queries/branches";
import { usersQuery } from "../../queries/users";
import { EnrolForm } from "../../components/devices/enrol/form";
import { PinForm } from "../../components/devices/pin/form";
import { devicesQuery, type DeviceView } from "../../queries/devices";
import { RevokeDeviceDialog } from "../../components/devices/revoke/dialog";
import { DeviceTable } from "../../components/devices/table";

export function DevicesScreen() {
  const queryClient = useQueryClient();
  const { data: devices } = useSuspenseQuery(devicesQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  // Context for the two sheets. A member without branch.read or user.read still sees the list.
  const branches = useQuery({ ...branchesQuery(), retry: false });
  const members = useQuery({ ...usersQuery(), retry: false });
  const addRef = useRef<HTMLButtonElement>(null);
  const pinRef = useRef<HTMLButtonElement>(null);
  const enrol = usePanel(addRef);
  const pin = usePanel(pinRef);
  const removal = usePanel<DeviceView>(addRef);
  const canEnrol = held.includes("device.enroll") && !!branches.data?.length;
  const canPin = held.includes("cashier.pin.assign");
  const hasBranchRead = held.includes("branch.read");
  const cannotReadBranches = held.includes("device.enroll") && !hasBranchRead;
  const branchChoicesFailed = held.includes("device.enroll") && hasBranchRead && branches.isError;
  const noPanelOpen = !enrol.open && !pin.open && !removal.open;
  const shortcuts = useShortcuts({
    N: () => canEnrol && noPanelOpen && enrol.show(),
    P: () => canPin && noPanelOpen && pin.show(),
  });
  const isEmpty = devices.length === 0;
  const closeEnrol = (open: boolean) => {
    enrol.setOpen(open);
    // The till redeems the code on its own, so the new device shows up once the sheet is done.
    if (!open) void queryClient.invalidateQueries({ queryKey: ["devices"] });
  };
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Devices"
        action={
          canEnrol && !isEmpty
            ? { label: "Enrol device", shortcut: "N", onClick: () => enrol.show(), ref: addRef }
            : undefined
        }
      >
        {canPin && (
          <Button ref={pinRef} variant="outline" onClick={() => pin.show()}>
            <KeyRoundIcon aria-hidden />
            Set cashier PIN
            <Kbd aria-hidden>P</Kbd>
          </Button>
        )}
      </PageHeader>
      {cannotReadBranches && !isEmpty && (
        <p className="-mt-3 text-sm text-muted-foreground">
          To enrol a device you need to be able to see branches. Ask an owner to enrol it.
        </p>
      )}
      {branchChoicesFailed && !isEmpty && (
        <p className="-mt-3 text-sm text-muted-foreground" role="status">
          Branch choices couldn’t load. Check your connection and refresh to try again.
        </p>
      )}
      {isEmpty ? (
        <EmptyList
          icon={MonitorSmartphoneIcon}
          title="No devices yet"
          description={
            branches.data?.length === 0
              ? "A device is a till that signs cashiers in to a branch. Add a branch first, then enrol the till."
              : "A device is a till that signs cashiers in to a branch. Enrol the till to get started."
          }
        >
          {branches.data?.length === 0 && (
            <Button asChild>
              <Link to="/branches">Go to branches</Link>
            </Button>
          )}
          {canEnrol && (
            <Button ref={addRef} onClick={() => enrol.show()}>
              Enrol device
              <Kbd aria-hidden>N</Kbd>
            </Button>
          )}
        </EmptyList>
      ) : (
        <DeviceTable
          devices={devices}
          onRevoke={
            held.includes("device.revoke")
              ? (device) => removal.show(device, deleteButtonId(device.id))
              : undefined
          }
        />
      )}
      <FormSheet
        open={enrol.open}
        onOpenChange={closeEnrol}
        title="Enrol a device"
        description="Choose the branch the till will work in. You get a code to enter on the till."
        restoreFocus={enrol.restoreFocus}
      >
        <EnrolForm branches={branches.data ?? []} />
      </FormSheet>
      <FormSheet
        open={pin.open}
        onOpenChange={pin.setOpen}
        title="Set cashier PIN"
        description="Give a member a PIN to sign in on a till."
        restoreFocus={pin.restoreFocus}
      >
        <PinForm
          members={members.data ?? []}
          unavailableMessage={
            members.isError
              ? members.error instanceof ApiError && members.error.status === 403
                ? "You can't see the member list, so ask an owner to set the PIN."
                : "Couldn't load the member list. Check your connection and refresh to try again."
              : undefined
          }
          onSaved={() => pin.setOpen(false)}
        />
      </FormSheet>
      <RevokeDeviceDialog
        device={removal.value}
        open={removal.open}
        onOpenChange={removal.setOpen}
        restoreFocus={removal.restoreFocus}
      />
    </div>
  );
}
