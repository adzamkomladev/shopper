import { Suspense, useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ReadOnlyNote } from "../../../components/admin/states";
import { CustomerSheet } from "../../../components/customers/form/sheet";
import { CustomersResults } from "../../../components/customers/list/results";
import { Segments } from "../../../components/customers/list/segments";
import { CustomersBodySkeleton, TableSkeleton } from "../../../components/customers/list/states";
import { CustomersToolbar } from "../../../components/customers/list/toolbar";
import { CustomersPage } from "../../../components/customers/tabs";
import { Gate, OfflineNote } from "../../../components/register/states";
import { usePanel } from "../../../hooks/admin/panel";
import { useCustomersSearch } from "../../../hooks/customers/search";
import { useCustomersCsv } from "../../../queries/customers/csv";
import { usePermissions } from "../../../queries/session/permissions";

/** Every active customer newest first, with search, a business and an archived segment and the CSV; a row opens the customer. */
export function CustomersScreen() {
  const canWrite = !!usePermissions()?.includes("customer.write");
  const addRef = useRef<HTMLButtonElement>(null);
  const form = usePanel(addRef);
  const add = canWrite && (
    <Button ref={addRef} onClick={() => form.show()}>
      Add customer
      <Kbd aria-hidden>N</Kbd>
    </Button>
  );
  return (
    <CustomersPage active="customers" action={add}>
      <Gate need="customer.read" what="customers" fallback={<CustomersBodySkeleton />}>
        <CustomersBody canWrite={canWrite} sheetOpen={form.open} onAdd={() => form.show()} />
      </Gate>
      <CustomerSheet
        open={form.open}
        onOpenChange={form.setOpen}
        restoreFocus={form.restoreFocus}
      />
    </CustomersPage>
  );
}

type BodyProps = { canWrite: boolean; sheetOpen: boolean; onAdd: () => void };

function CustomersBody({ canWrite, sheetOpen, onAdd }: BodyProps) {
  const search = useSearch({ from: "/_shop/customers" });
  const online = useOnline();
  const searchRef = useRef<HTMLInputElement>(null);
  const state = useCustomersSearch(search);
  const csv = useCustomersCsv();
  const shortcuts = useShortcuts(
    sheetOpen
      ? {}
      : {
          "/": () => searchRef.current?.focus(),
          D: () => csv.mutate(),
          ...(canWrite && { N: onAdd }),
        },
  );
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6">
      {!online && (
        <OfflineNote>
          You're seeing the customers loaded earlier. Adding or changing one needs a connection.
        </OfflineNote>
      )}
      {!canWrite && (
        <ReadOnlyNote>
          You can view customers. Ask a manager for permission to add or edit them.
        </ReadOnlyNote>
      )}
      <CustomersToolbar
        text={state.text}
        onTextChange={state.onTextChange}
        onSearchKeyDown={state.onSearchKeyDown}
        searchRef={searchRef}
        onDownload={() => csv.mutate()}
        downloading={csv.isPending}
      />
      <Segments segment={search.segment} q={search.q}>
        <Suspense fallback={<TableSkeleton />}>
          <CustomersResults
            q={search.q}
            segment={search.segment}
            onAdd={canWrite ? onAdd : undefined}
            onClear={() => {
              state.clear();
              searchRef.current?.focus();
            }}
          />
        </Suspense>
      </Segments>
    </div>
  );
}
