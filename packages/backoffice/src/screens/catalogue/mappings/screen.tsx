import { useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ScanBarcodeIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { FormSheet } from "../../../components/admin/form/sheet";
import { PageHeader } from "../../../components/admin/page/header";
import { deleteButtonId, editButtonId } from "../../../components/admin/row/actions";
import { EmptyList, ReadOnlyNote } from "../../../components/admin/states";
import { DeleteMappingDialog } from "../../../components/catalogue/mappings/delete/dialog";
import { MappingForm } from "../../../components/catalogue/mappings/form";
import { MappingTable } from "../../../components/catalogue/mappings/table";
import { usePanel } from "../../../hooks/admin/panel";
import { mappingsQuery } from "../../../queries/catalogue/mappings";
import { permissionsQuery } from "../../../queries/session/permissions";
import type { MappingView } from "../../../schemas/catalogue/mappings";

// Prefixes 20 to 29, one layout each.
const MAX_LAYOUTS = 10;

export function MappingsScreen() {
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: layouts } = useSuspenseQuery(mappingsQuery());
  const canWrite = held.includes("product.write");
  const full = layouts.length >= MAX_LAYOUTS;
  const canAdd = canWrite && !full;
  const addRef = useRef<HTMLButtonElement>(null);
  const form = usePanel<MappingView>(addRef);
  const removal = usePanel<MappingView>(addRef);
  const shortcuts = useShortcuts({
    N: () => canAdd && !form.open && !removal.open && form.show(),
  });
  const isEmpty = layouts.length === 0;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Barcode layouts"
        action={
          isEmpty || !canAdd
            ? undefined
            : { label: "Add layout", shortcut: "N", onClick: () => form.show(), ref: addRef }
        }
      />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Scale and price labels carry a product code and a weight or price inside a 13-digit barcode
        that starts with 20 to 29. Tell the till where to read each one.
      </p>
      {!canWrite && (
        <ReadOnlyNote>
          You can view barcode layouts. Ask an owner for permission to make changes.
        </ReadOnlyNote>
      )}
      {full && canWrite && (
        <ReadOnlyNote>Every prefix from 20 to 29 has a layout. Edit one to change it.</ReadOnlyNote>
      )}
      {isEmpty ? (
        <EmptyList
          icon={ScanBarcodeIcon}
          title="No barcode layouts yet"
          description={
            canWrite
              ? "Add the layout your scale prints, so scanning a label adds the product and its weight."
              : "Until one is added, tills can't read weights or prices from labels."
          }
        >
          {canAdd && (
            <Button ref={addRef} onClick={() => form.show()}>
              Add layout
              <Kbd aria-hidden>N</Kbd>
            </Button>
          )}
        </EmptyList>
      ) : (
        <MappingTable
          mappings={layouts}
          onEdit={canWrite ? (layout) => form.show(layout, editButtonId(layout.id)) : undefined}
          onDelete={
            canWrite ? (layout) => removal.show(layout, deleteButtonId(layout.id)) : undefined
          }
        />
      )}
      <FormSheet
        open={form.open}
        onOpenChange={form.setOpen}
        title={form.value ? "Edit layout" : "New layout"}
        description={
          form.value
            ? "Change where the till reads this label's digits."
            : "Say which digits hold the product code and the weight or price."
        }
        restoreFocus={form.restoreFocus}
      >
        <MappingForm
          key={form.value?.id ?? "new"}
          mapping={form.value}
          layouts={layouts}
          onSaved={() => form.setOpen(false)}
        />
      </FormSheet>
      <DeleteMappingDialog
        mapping={removal.value}
        open={removal.open}
        onOpenChange={removal.setOpen}
        restoreFocus={removal.restoreFocus}
      />
    </div>
  );
}
