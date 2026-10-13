import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { GitBranchIcon, StoreIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { FormSheet } from "../../components/admin/form-sheet";
import { PageHeader } from "../../components/admin/page-header";
import { deleteButtonId, editButtonId } from "../../components/admin/row-actions";
import { EmptyList, ReadOnlyNote } from "../../components/admin/states";
import { usePanel } from "../../components/admin/use-panel";
import { permissionsQuery } from "../../session/permissions";
import { storesQuery } from "../stores/queries";
import { DeleteBranchDialog } from "./delete-dialog";
import { BranchForm } from "./form";
import { branchesQuery } from "./queries";
import { BranchTable } from "./table";

type Branch = { id: string; name: string; storeId: string };

export function BranchesScreen() {
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: branches } = useSuspenseQuery(branchesQuery());
  const canReadStores = held.includes("store.read");
  const storeContext = useQuery({ ...storesQuery(), enabled: canReadStores });
  const stores = storeContext.data;
  const canWrite = held.includes("branch.write");
  const canEdit = canWrite && canReadStores && !!stores?.length;
  const addRef = useRef<HTMLButtonElement>(null);
  const form = usePanel<Branch>(addRef);
  const removal = usePanel<Branch>(addRef);
  const noPanelOpen = !form.open && !removal.open;
  const shortcuts = useShortcuts({ N: () => canEdit && noPanelOpen && form.show() });
  const isEmpty = branches.length === 0;

  if (canReadStores && stores?.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Branches" />
        <EmptyList
          icon={StoreIcon}
          title="Add a store first"
          description="Every branch belongs to a store. Add one, then come back to add its branches."
        >
          <Button asChild>
            <Link to="/stores">Go to stores</Link>
          </Button>
        </EmptyList>
      </div>
    );
  }

  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Branches"
        action={
          isEmpty || !canEdit
            ? undefined
            : { label: "Add branch", shortcut: "N", onClick: () => form.show(), ref: addRef }
        }
      />
      {(!canWrite || !canReadStores) && !(canReadStores && storeContext.isPending) && (
        <ReadOnlyNote>
          {canWrite
            ? "Viewing stores is needed to create or move a branch."
            : "You can view branches. Ask an owner for permission to make changes."}
        </ReadOnlyNote>
      )}
      {isEmpty ? (
        <EmptyList
          icon={GitBranchIcon}
          title="No branches yet"
          description="Tills and stock belong to a branch. Add the place where you sell."
        >
          {canEdit && (
            <Button ref={addRef} onClick={() => form.show()}>
              Add branch
              <Kbd aria-hidden>N</Kbd>
            </Button>
          )}
        </EmptyList>
      ) : (
        <BranchTable
          branches={branches}
          storeNames={new Map((stores ?? []).map((store) => [store.id, store.name]))}
          onEdit={canEdit ? (branch) => form.show(branch, editButtonId(branch.id)) : undefined}
          onDelete={
            canWrite ? (branch) => removal.show(branch, deleteButtonId(branch.id)) : undefined
          }
        />
      )}
      <FormSheet
        open={form.open}
        onOpenChange={form.setOpen}
        title={form.value ? "Edit branch" : "New branch"}
        description={
          form.value
            ? "Rename the branch or move it to another store."
            : "Name the branch and choose its store."
        }
        restoreFocus={form.restoreFocus}
      >
        <BranchForm
          key={form.value?.id ?? "new"}
          branch={form.value}
          stores={stores ?? []}
          onSaved={() => form.setOpen(false)}
        />
      </FormSheet>
      <DeleteBranchDialog
        branch={removal.value}
        open={removal.open}
        onOpenChange={removal.setOpen}
        restoreFocus={removal.restoreFocus}
      />
    </div>
  );
}
