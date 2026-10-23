import { useRef } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ReadOnlyNote } from "../../../components/admin/states";
import { AccountActions, AccountDialogs } from "../../../components/customers/account/actions";
import { ArchiveDialog } from "../../../components/customers/archive/dialog";
import { CustomerHeader } from "../../../components/customers/detail/header";
import { MergedNote, SharedPhoneNote } from "../../../components/customers/detail/notes";
import { CustomerSkeleton } from "../../../components/customers/detail/states";
import { CustomerDetails, CustomerSummary } from "../../../components/customers/detail/summary";
import { CustomerTabs } from "../../../components/customers/detail/tabs";
import { CustomerSheet } from "../../../components/customers/form/sheet";
import { MergeDialog } from "../../../components/customers/merge/dialog";
import { Gate, OfflineNote } from "../../../components/register/states";
import { usePanel } from "../../../hooks/admin/panel";
import { useAccountPanels } from "../../../hooks/customers/panels";
import { customerQuery } from "../../../queries/customers/list";
import { useSharedPhone } from "../../../queries/customers/shared";
import { useCustomerStatus } from "../../../queries/customers/status";
import { usePermissions } from "../../../queries/session/permissions";

/** One customer: what they owe, their limit and points, who they are, and edit, merge and archive. */
export function CustomerScreen() {
  return (
    <Gate need="customer.read" what="customers" fallback={<CustomerSkeleton />}>
      <Customer />
    </Gate>
  );
}

function Customer() {
  const { customerId } = useParams({ from: "/_shop/customers/$customerId" });
  const { tab } = useSearch({ from: "/_shop/customers/$customerId" });
  const { data: customer } = useSuspenseQuery(customerQuery(customerId));
  const online = useOnline();
  const held = usePermissions();
  const editRef = useRef<HTMLButtonElement>(null);
  const mergeRef = useRef<HTMLButtonElement>(null);
  const archiveRef = useRef<HTMLButtonElement>(null);
  const edit = usePanel(editRef);
  const merge = usePanel<string>(mergeRef);
  const archive = usePanel(archiveRef);
  const account = useAccountPanels();
  const restore = useCustomerStatus(customer.id, "unarchive");
  const shared = useSharedPhone(customer);
  // A merged customer is final: nothing about them can be changed.
  const merged = !!customer.mergedIntoId;
  const canEdit = !!held?.includes("customer.write") && !merged;
  const canManage = !!held?.includes("customer.manage") && !merged;
  const busy = edit.open || merge.open || archive.open || account.busy;
  const onEdit = canEdit ? () => edit.show() : undefined;
  const onMerge = canManage && !customer.archivedAt ? () => merge.show("") : undefined;
  const onArchive = canManage
    ? () => (customer.archivedAt ? restore.mutate() : archive.show())
    : undefined;
  const verified = !!customer.kycVerifiedAt;
  const shortcuts = useShortcuts(
    busy
      ? {}
      : {
          ...(canManage && {
            P: () => account.pay.show(),
            C: () => account.note.show(),
            T: () => account.transfer.show(),
            ...(verified && { L: () => account.limit.show() }),
          }),
          ...(onEdit && { E: onEdit }),
          ...(onMerge && { M: onMerge }),
          ...(onArchive && { "Alt+A": onArchive }),
        },
  );
  return (
    <div ref={shortcuts} className="flex flex-col gap-6 pb-6">
      <CustomerHeader
        customer={customer}
        onEdit={onEdit}
        onMerge={onMerge}
        onArchive={onArchive}
        archiving={restore.isPending}
        editRef={editRef}
        mergeRef={mergeRef}
        archiveRef={archiveRef}
      />
      {!online && (
        <OfflineNote>
          You're seeing this customer as loaded earlier. Changing them needs a connection.
        </OfflineNote>
      )}
      {restore.error && (
        <p role="alert" className="text-sm text-destructive">
          {restore.error.message}
        </p>
      )}
      {merged && <MergedNote intoId={customer.mergedIntoId!} />}
      {shared.length > 0 && (
        <SharedPhoneNote others={shared} onMerge={onMerge && (() => merge.show(customer.phone))} />
      )}
      {!merged && held && <Permissions canEdit={canEdit} canManage={canManage} />}
      <CustomerSummary customer={customer} />
      {canManage && <AccountActions panels={account} customer={customer} />}
      <CustomerDetails customer={customer} />
      <CustomerTabs customer={customer} tab={tab} canManage={canManage} />
      <CustomerSheet
        open={edit.open}
        onOpenChange={edit.setOpen}
        restoreFocus={edit.restoreFocus}
        customer={customer}
      />
      <MergeDialog
        keep={customer}
        open={merge.open}
        onOpenChange={merge.setOpen}
        restoreFocus={merge.restoreFocus}
        initialText={merge.value ?? ""}
      />
      <AccountDialogs panels={account} customer={customer} />
      <ArchiveDialog
        customer={customer}
        open={archive.open}
        onOpenChange={archive.setOpen}
        restoreFocus={archive.restoreFocus}
      />
    </div>
  );
}

/** Tells a member who can look but not do everything why some buttons are missing. */
function Permissions({ canEdit, canManage }: { canEdit: boolean; canManage: boolean }) {
  if (canEdit && canManage) return null;
  return (
    <ReadOnlyNote>
      {canManage
        ? "Ask a manager for permission to edit this customer."
        : canEdit
          ? "Ask a manager for permission to take payments, set limits, send statements, or archive or merge customers."
          : "You can view this customer. Ask a manager for permission to change them."}
    </ReadOnlyNote>
  );
}
