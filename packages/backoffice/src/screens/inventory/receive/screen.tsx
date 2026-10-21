import { useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { v7 } from "uuid";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormSheet } from "../../../components/admin/form/sheet";
import { BranchField } from "../../../components/inventory/entry/branch";
import { DiscardDialog } from "../../../components/inventory/entry/discard";
import { EntryFooter } from "../../../components/inventory/entry/footer";
import { EntryLines } from "../../../components/inventory/entry/lines";
import { EntryPage } from "../../../components/inventory/entry/page";
import { EntrySkeleton, NoLines } from "../../../components/inventory/entry/states";
import { SaveProblem } from "../../../components/inventory/entry/problem";
import { SupplierField } from "../../../components/inventory/receive/supplier";
import { NoBranch } from "../../../components/inventory/stock/list/states";
import { SupplierForm } from "../../../components/suppliers/form";
import { Gate, OfflineNote } from "../../../components/register/states";
import { ProductSearch } from "../../../components/stock/document/search";
import { useDiscardGuard } from "../../../hooks/inventory/entry/discard";
import { useDraftLines } from "../../../hooks/inventory/entry/lines";
import { entryKeys } from "../../../hooks/inventory/entry/keys";
import { usePanel } from "../../../hooks/admin/panel";
import {
  entryId,
  failedField,
  orderTotal,
  receiptLines,
  SEARCH_ID,
  withServerError,
} from "../../../lib/inventory/entry";
import { pickBranch } from "../../../lib/inventory/format";
import type { Chosen } from "../../../lib/inventory/types";
import { stockFindQuery, useSaveRecord } from "../../../queries/inventory/records";
import { stockBranchesQuery } from "../../../queries/inventory/stock";
import { suppliersQuery } from "../../../queries/suppliers";

/** Goods received from a supplier: the products with their quantity and unit cost, saved as one record. */
export function ReceiveScreen() {
  return (
    <Gate need="stock.write" verb="receive" what="goods" fallback={<EntrySkeleton />}>
      {/* A delivery is from a supplier, so the list of them is needed too. */}
      <Gate need="product.read" what="suppliers" fallback={<EntrySkeleton />}>
        <Receive />
      </Gate>
    </Gate>
  );
}

function Receive() {
  const { branch: requested } = useSearch({ from: "/_shop/stock/receive" });
  const { data } = useSuspenseQuery(stockBranchesQuery());
  const branch = pickBranch(data.branches, requested);
  return branch ? <ReceiveForm branches={data.branches} branchId={branch.id} /> : <NoBranch />;
}

type Props = { branches: { id: string; name: string }[]; branchId: string };

function ReceiveForm({ branches, branchId }: Props) {
  const navigate = useNavigate();
  const online = useOnline();
  const { data: suppliers } = useSuspenseQuery(suppliersQuery());
  const [id] = useState(() => v7());
  const draft = useDraftLines(true);
  const guard = useDiscardGuard(draft.lines.length > 0);
  const [supplier, setSupplier] = useState<Chosen | null>(null);
  const [reference, setReference] = useState("");
  const [missing, setMissing] = useState<{ supplier?: string; lines?: string }>({});
  const addRef = useRef<HTMLButtonElement>(null);
  const sheet = usePanel(addRef);
  const savedSupplier = useRef(false);
  const save = useSaveRecord("receipts", (documentId) => {
    guard.markSaved();
    return navigate({ to: "/stock/records/$documentId", params: { documentId } });
  });
  const failure = failedField(save.error, draft.lines);
  const focusId = (target: string) => document.getElementById(target)?.focus();
  const changed = () => {
    if (save.isError) save.reset();
  };

  function submit() {
    if (!online || save.isPending) return;
    const linesOk = draft.validate();
    const found = {
      supplier: supplier ? undefined : "Choose who the goods came from",
      lines: draft.lines.length ? undefined : "Add a product first",
    };
    setMissing(found);
    if (found.supplier) return focusId(entryId("supplierId"));
    if (!linesOk || found.lines) return;
    save.mutate(
      {
        id,
        branchId,
        supplierId: supplier!.id,
        ...(reference.trim() && { reference: reference.trim() }),
        lines: receiptLines(draft.lines),
      },
      { onError: (error) => focusId(failedField(error, draft.lines)?.field ?? "") },
    );
  }

  const shortcuts = useShortcuts({ S: () => sheet.show(), "/": () => focusId(SEARCH_ID) });
  const onKeyDown = entryKeys({
    submit,
    back: () => void navigate({ to: "/stock/records", search: { branch: branchId } }),
  });
  return (
    <>
      <EntryPage
        title="Receive goods"
        description="Record a delivery: who it came from, what arrived and what each unit cost."
        branchId={branchId}
        onKeyDown={onKeyDown}
        shortcuts={shortcuts}
      >
        {!online && (
          <OfflineNote>
            You're not connected. Receiving stock needs a connection to save.
          </OfflineNote>
        )}
        <div className="grid gap-4 rounded-xl border bg-card p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <BranchField
            branches={branches}
            value={branchId}
            disabled={save.isPending}
            onChange={(branch) =>
              void navigate({ to: "/stock/receive", search: { branch }, replace: true })
            }
          />
          <SupplierField
            suppliers={suppliers}
            value={supplier}
            onChange={(picked) => {
              setSupplier(picked);
              setMissing((previous) => ({ ...previous, supplier: undefined }));
            }}
            onAdd={() => sheet.show()}
            addRef={addRef}
            error={
              missing.supplier ??
              (failure?.field === entryId("supplierId") ? failure.message : undefined)
            }
          />
          <Field>
            <FieldLabel htmlFor={entryId("reference")}>
              Delivery note or invoice (optional)
            </FieldLabel>
            <Input
              id={entryId("reference")}
              value={reference}
              maxLength={200}
              autoComplete="off"
              aria-invalid={failure?.field === entryId("reference") ? true : undefined}
              onChange={(event) => {
                setReference(event.target.value);
                changed();
              }}
            />
          </Field>
        </div>
        <ProductSearch
          id={SEARCH_ID}
          query={stockFindQuery(branchId)}
          touch={false}
          shortcut="/"
          onPick={(product) => {
            setMissing((previous) => ({ ...previous, lines: undefined }));
            changed();
            draft.add(product);
          }}
        />
        {draft.lines.length === 0 ? (
          <NoLines />
        ) : (
          <EntryLines
            lines={draft.lines}
            errors={withServerError(draft.errors, failure)}
            costed
            onEdit={(productId, field, value) => {
              changed();
              draft.edit(productId, field, value);
            }}
            onRemove={draft.remove}
          />
        )}
        <SaveProblem lines={missing.lines} error={failure ? undefined : save.error} />
        <EntryFooter
          total={orderTotal(draft.lines)}
          label="Receive stock"
          pending={save.isPending}
          online={online}
          branchId={branchId}
          onSubmit={submit}
        />
      </EntryPage>
      <DiscardDialog
        open={guard.blocker.status === "blocked"}
        what="delivery"
        onDiscard={() => guard.blocker.proceed?.()}
        onKeep={() => guard.blocker.reset?.()}
      />
      <FormSheet
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        title="New supplier"
        description="Name the supplier. Contact details are optional."
        restoreFocus={() => {
          // A saved supplier sends focus on to the products; cancelling returns to Add supplier.
          if (!savedSupplier.current) return sheet.restoreFocus();
          savedSupplier.current = false;
          focusId(SEARCH_ID);
        }}
      >
        <SupplierForm
          onSaved={({ id: supplierId, name }) => {
            savedSupplier.current = true;
            setSupplier({ id: supplierId, name });
            setMissing((previous) => ({ ...previous, supplier: undefined }));
            sheet.setOpen(false);
          }}
        />
      </FormSheet>
    </>
  );
}
