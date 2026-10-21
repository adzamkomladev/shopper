import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { v7 } from "uuid";
import { formatQuantity, parseQuantity } from "@shopper/utils";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { CauseFields } from "../../../components/inventory/adjust/cause";
import { BranchField } from "../../../components/inventory/entry/branch";
import { DiscardDialog } from "../../../components/inventory/entry/discard";
import { EntryFooter } from "../../../components/inventory/entry/footer";
import { EntryLines } from "../../../components/inventory/entry/lines";
import { EntryPage } from "../../../components/inventory/entry/page";
import { SaveProblem } from "../../../components/inventory/entry/problem";
import { AdjustSkeleton, NoLines } from "../../../components/inventory/entry/states";
import { NoBranch } from "../../../components/inventory/stock/list/states";
import { Gate, OfflineNote } from "../../../components/register/states";
import { ProductSearch } from "../../../components/stock/document/search";
import { entryKeys } from "../../../hooks/inventory/entry/keys";
import { useDiscardGuard } from "../../../hooks/inventory/entry/discard";
import { useDraftLines } from "../../../hooks/inventory/entry/lines";
import {
  adjustmentLines,
  entryId,
  failedField,
  SEARCH_ID,
  withServerError,
} from "../../../lib/inventory/entry";
import { pickBranch } from "../../../lib/inventory/format";
import { adjustmentSign } from "../../../lib/inventory/records";
import type { Cause, DraftLine, Direction, Effect } from "../../../lib/inventory/types";
import { stockFindQuery, useSaveRecord } from "../../../queries/inventory/records";
import { stockBranchesQuery } from "../../../queries/inventory/stock";

/** Wastage, theft, found stock and other corrections: the products and quantities, with the cause on the record. */
export function AdjustScreen() {
  return (
    <Gate need="stock.write" verb="adjust" what="stock" fallback={<AdjustSkeleton />}>
      <Adjust />
    </Gate>
  );
}

function Adjust() {
  const { branch: requested } = useSearch({ from: "/_shop/stock/adjust" });
  const { data } = useSuspenseQuery(stockBranchesQuery());
  const branch = pickBranch(data.branches, requested);
  return branch ? <AdjustForm branches={data.branches} branchId={branch.id} /> : <NoBranch />;
}

type Props = { branches: { id: string; name: string }[]; branchId: string };

function AdjustForm({ branches, branchId }: Props) {
  const navigate = useNavigate();
  const online = useOnline();
  const [id] = useState(() => v7());
  const draft = useDraftLines(false);
  const guard = useDiscardGuard(draft.lines.length > 0);
  const [cause, setCause] = useState<Cause | "">("");
  const [direction, setDirection] = useState<Direction | "">("");
  const [missing, setMissing] = useState<{ cause?: string; direction?: string; lines?: string }>(
    {},
  );
  const save = useSaveRecord("adjustments", (documentId) => {
    guard.markSaved();
    return navigate({ to: "/stock/records/$documentId", params: { documentId } });
  });
  const failure = failedField(save.error, draft.lines);
  const sign = adjustmentSign(cause, direction);
  const focusId = (target: string) => document.getElementById(target)?.focus();
  const changed = () => {
    if (save.isError) save.reset();
  };

  function submit() {
    if (!online || save.isPending) return;
    const linesOk = draft.validate();
    const found = {
      cause: cause ? undefined : "Choose why stock is changing",
      direction: cause === "other" && !direction ? "Choose a direction" : undefined,
      lines: draft.lines.length ? undefined : "Add a product first",
    };
    setMissing(found);
    if (found.cause) return focusId(entryId("cause"));
    if (found.direction) return focusId(entryId("direction"));
    if (!linesOk || found.lines) return;
    save.mutate(
      {
        id,
        branchId,
        cause,
        ...(cause === "other" && { direction }),
        lines: adjustmentLines(draft.lines),
      },
      { onError: (error) => focusId(failedField(error, draft.lines)?.field ?? "") },
    );
  }

  const effect = (line: DraftLine): Effect | undefined => {
    const quantity = parseQuantity(line.quantity);
    if (cause === "other" && !direction) return { text: "Choose a direction", tone: "unset" };
    if (sign === null || quantity === null) return undefined;
    const text = `${sign < 0 ? "removes" : "adds"} ${formatQuantity(quantity)} ${line.baseUnit}`;
    return { text, tone: sign < 0 ? "remove" : "add" };
  };
  const shortcuts = useShortcuts({ "/": () => focusId(SEARCH_ID) });
  const onKeyDown = entryKeys({
    submit,
    back: () => void navigate({ to: "/stock/records", search: { branch: branchId } }),
  });
  return (
    <>
      <EntryPage
        title="Adjust stock"
        description="Record wastage, theft or found stock, with the reason. Quantities are in each product's own unit."
        branchId={branchId}
        onKeyDown={onKeyDown}
        shortcuts={shortcuts}
      >
        {!online && (
          <OfflineNote>
            You're not connected. Adjusting stock needs a connection to save.
          </OfflineNote>
        )}
        <div className="grid gap-4 rounded-xl border bg-card p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <BranchField
            branches={branches}
            value={branchId}
            disabled={save.isPending}
            onChange={(branch) =>
              void navigate({ to: "/stock/adjust", search: { branch }, replace: true })
            }
          />
          <CauseFields
            cause={cause}
            direction={direction}
            onCause={(picked) => {
              setCause(picked);
              setMissing((previous) => ({ ...previous, cause: undefined }));
              changed();
            }}
            onDirection={(picked) => {
              setDirection(picked);
              setMissing((previous) => ({ ...previous, direction: undefined }));
              changed();
            }}
            causeError={missing.cause}
            directionError={missing.direction}
          />
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
            costed={false}
            effect={effect}
            onEdit={(productId, field, value) => {
              changed();
              draft.edit(productId, field, value);
            }}
            onRemove={draft.remove}
          />
        )}
        <SaveProblem lines={missing.lines} error={failure ? undefined : save.error} />
        <EntryFooter
          label="Adjust stock"
          pending={save.isPending}
          online={online}
          branchId={branchId}
          onSubmit={submit}
        />
      </EntryPage>
      <DiscardDialog
        open={guard.blocker.status === "blocked"}
        what="adjustment"
        onDiscard={() => guard.blocker.proceed?.()}
        onKeep={() => guard.blocker.reset?.()}
      />
    </>
  );
}
