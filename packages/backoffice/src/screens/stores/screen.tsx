import { useRef } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { StoreIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { FormSheet } from "../../components/admin/form-sheet";
import { PageHeader } from "../../components/admin/page-header";
import { deleteButtonId, editButtonId } from "../../components/admin/row-actions";
import { EmptyList, ReadOnlyNote } from "../../components/admin/states";
import { usePanel } from "../../components/admin/use-panel";
import { permissionsQuery } from "../../session/permissions";
import { branchesQuery } from "../catalogue/detail/queries";
import type { StoreView } from "../../schemas/management";
import { DeleteStoreDialog } from "./delete-dialog";
import { StoreForm } from "./form";
import { storesQuery } from "./queries";
import { StoreTable } from "./table";

export function StoresScreen() {
  const { data: stores } = useSuspenseQuery(storesQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  // Only used to explain a refused delete; a role without branch.read gets the server's answer instead.
  const { data: branches } = useQuery(branchesQuery());
  const addRef = useRef<HTMLButtonElement>(null);
  const form = usePanel<StoreView>(addRef);
  const removal = usePanel<StoreView>(addRef);
  const noPanelOpen = !form.open && !removal.open;
  const canWrite = held.includes("store.write");
  const shortcuts = useShortcuts({ N: () => canWrite && noPanelOpen && form.show() });
  const isEmpty = stores.length === 0;
  const branchCount = (store?: StoreView) =>
    branches && store ? branches.filter((branch) => branch.storeId === store.id).length : null;
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Stores"
        action={
          isEmpty || !canWrite
            ? undefined
            : { label: "Add store", shortcut: "N", onClick: () => form.show(), ref: addRef }
        }
      />
      {!canWrite && (
        <ReadOnlyNote>
          You can view stores. Ask an owner for permission to make changes.
        </ReadOnlyNote>
      )}
      {isEmpty ? (
        <EmptyList
          icon={StoreIcon}
          title="No stores yet"
          description="A store groups your branches and sets how cash totals are rounded. Add one to start."
        >
          {canWrite && (
            <Button ref={addRef} onClick={() => form.show()}>
              Add store
              <Kbd aria-hidden>N</Kbd>
            </Button>
          )}
        </EmptyList>
      ) : (
        <StoreTable
          stores={stores}
          onEdit={canWrite ? (store) => form.show(store, editButtonId(store.id)) : undefined}
          onDelete={canWrite ? (store) => removal.show(store, deleteButtonId(store.id)) : undefined}
        />
      )}
      <FormSheet
        open={form.open}
        onOpenChange={form.setOpen}
        title={form.value ? "Edit store" : "New store"}
        description={
          form.value ? "Change the name or how cash is rounded." : "Give the store a name."
        }
        restoreFocus={form.restoreFocus}
      >
        <StoreForm
          key={form.value?.id ?? "new"}
          store={form.value}
          onSaved={() => form.setOpen(false)}
        />
      </FormSheet>
      <DeleteStoreDialog
        store={removal.value}
        open={removal.open}
        onOpenChange={removal.setOpen}
        branchCount={branchCount(removal.value)}
        restoreFocus={removal.restoreFocus}
      />
    </div>
  );
}
