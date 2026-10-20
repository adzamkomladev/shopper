import { useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TruckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormSheet } from "../../components/admin/form/sheet";
import { PageHeader } from "../../components/admin/page/header";
import { editButtonId } from "../../components/admin/row/actions";
import { EmptyList, ReadOnlyNote } from "../../components/admin/states";
import { Gate, OfflineNote } from "../../components/register/states";
import { SupplierForm } from "../../components/suppliers/form";
import { SupplierTable } from "../../components/suppliers/table";
import { usePanel } from "../../hooks/admin/panel";
import { suppliersQuery, type SupplierView } from "../../queries/suppliers";
import { usePermissions } from "../../queries/session/permissions";
import { ListSkeleton } from "../../components/admin/states";

/** The people goods are bought from. Anyone who can view products can look; stock.write adds and edits. */
export function SuppliersScreen() {
  return (
    <Gate
      need="product.read"
      what="suppliers"
      fallback={<ListSkeleton label="Loading suppliers" />}
    >
      <Suppliers />
    </Gate>
  );
}

function Suppliers() {
  const { data: suppliers } = useSuspenseQuery(suppliersQuery());
  const online = useOnline();
  const canWrite = usePermissions()?.includes("stock.write");
  const addRef = useRef<HTMLButtonElement>(null);
  const form = usePanel<SupplierView>(addRef);
  const shortcuts = useShortcuts({ N: () => canWrite && !form.open && form.show() });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Suppliers"
        action={
          canWrite && suppliers.length > 0
            ? { label: "Add supplier", shortcut: "N", onClick: () => form.show(), ref: addRef }
            : undefined
        }
      />
      {!online && (
        <OfflineNote>
          You're seeing the suppliers loaded earlier. Adding or changing one needs a connection.
        </OfflineNote>
      )}
      {!canWrite && (
        <ReadOnlyNote>
          You can view suppliers. Ask a manager for permission to add or change them.
        </ReadOnlyNote>
      )}
      {suppliers.length === 0 ? (
        <EmptyList
          icon={TruckIcon}
          title="No suppliers yet"
          description="A supplier is who you buy stock from. Add them here, then name them when you record a delivery."
        >
          {canWrite && (
            <Button ref={addRef} onClick={() => form.show()}>
              Add supplier
              <Kbd aria-hidden>N</Kbd>
            </Button>
          )}
        </EmptyList>
      ) : (
        <SupplierTable
          suppliers={suppliers}
          onEdit={
            canWrite ? (supplier) => form.show(supplier, editButtonId(supplier.id)) : undefined
          }
        />
      )}
      <FormSheet
        open={form.open}
        onOpenChange={form.setOpen}
        title={form.value ? "Edit supplier" : "New supplier"}
        description={
          form.value
            ? "Change their name or contact details. Clear a field to remove it."
            : "Name the supplier. Contact details are optional."
        }
        restoreFocus={form.restoreFocus}
      >
        <SupplierForm
          key={form.value?.id ?? "new"}
          supplier={form.value}
          onSaved={() => form.setOpen(false)}
        />
      </FormSheet>
    </div>
  );
}
