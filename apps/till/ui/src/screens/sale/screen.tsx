import { useRef, useState } from "react";
import { money } from "@shopper/money";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useScanField } from "../../hooks/scanner";
import { Lines } from "../../components/sale/lines";
import { SaleHeader } from "../../components/sale/header";
import { ShortcutHints } from "../../components/sale/hints";
import { addInputFor, ScanEntry, SearchResults } from "../../components/sale/search";
import {
  EmptyBasket,
  LinesSkeleton,
  SaleBanners,
  UnavailableBasket,
} from "../../components/sale/states";
import { TaxSummary } from "../../components/sale/summary";
import { CartTotals } from "../../components/sale/totals";
import { isPriced, rowsOf, selectedRow } from "../../sale/rows";
import type { CatalogueMatch, SaleActions, SaleSnapshot } from "../../sale/types";

const bannerId = "sale-banner";

/**
 * The cashier workspace. It draws one snapshot and reports intent through `actions`; it fetches
 * nothing. `onRegister` returns to the register connection screen.
 */
export function SaleScreen({
  snapshot,
  actions,
  onRegister,
}: {
  snapshot: SaleSnapshot;
  actions: SaleActions;
  onRegister: () => void;
}) {
  const { host, view, failure, busy, search, loading, sync } = snapshot;
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const locked = host !== "connected" || failure !== null;
  const rows = rowsOf(view);
  const selected = selectedRow(rows, selectedId);
  const matches = search.matches;
  const active = Math.min(activeIndex, matches.length - 1);

  const field = useScanField({
    onScan: (code) => actions.add({ code }),
    onSearch: (text) => {
      setActiveIndex(0);
      actions.search(text);
    },
    onEnter: (text) => {
      const match = matches[active];
      // A reply for older text may still be on its way; Enter never adds from it.
      if (match && search.query === text) pick(match);
    },
  });
  const searching = field.query.trim() !== "";
  const busyOrLocked = locked || busy;

  function pick(match: CatalogueMatch) {
    actions.add(addInputFor(match));
    field.clear();
    scanRef.current?.focus();
  }

  function focusScan() {
    scanRef.current?.focus();
    scanRef.current?.select();
  }

  function startEdit() {
    if (busyOrLocked || !selected || !isPriced(selected)) return;
    setEditingId(selected.lineId);
  }

  function finishEdit() {
    setEditingId(null);
  }

  function escape() {
    finishEdit();
    field.clear();
    if (snapshot.feedback) actions.dismissFeedback();
    focusScan();
  }

  function setQuantity(lineId: string, thousandths: number) {
    if (busyOrLocked) return;
    actions.setQuantity(lineId, thousandths);
    setSelectedId(lineId);
    finishEdit();
    focusScan();
  }

  // Keyboard removal stays in the basket; the last line leaves nothing to stay on.
  function remove(lineId: string) {
    if (busyOrLocked) return;
    actions.removeLine(lineId);
    if (rows.length > 1) listRef.current?.focus();
    else focusScan();
  }

  function onScanKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (searching && matches.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(Math.min(matches.length - 1, Math.max(0, active + step)));
    }
    field.props.onKeyDown(event);
  }

  const registerShortcuts = useShortcuts({
    F2: focusScan,
    F3: () => listRef.current?.focus(),
    F4: startEdit,
    F8: () => sync.canSync && actions.syncNow(),
    F9: actions.reconnect,
    F10: onRegister,
    Escape: escape,
  });
  // With the scan field disabled nothing else takes focus, so the screen holds it for its keys.
  const shortcuts = (node: HTMLElement | null) => {
    const cleanup = registerShortcuts(node);
    if (node && document.activeElement === document.body) node.focus();
    return cleanup;
  };

  return (
    <main
      aria-label="Sale"
      className="flex h-full min-h-0 flex-col gap-3 outline-none"
      ref={shortcuts}
      tabIndex={-1}
    >
      <SaleHeader host={host} onRegister={onRegister} onSyncNow={actions.syncNow} sync={sync} />
      <SaleBanners actions={actions} describedBy={bannerId} rows={rows} snapshot={snapshot} />
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-6">
        <section
          aria-label="Basket"
          className="col-span-7 flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm"
        >
          <ScanEntry
            activeIndex={searching && matches.length > 0 ? active : null}
            describedBy={locked ? bannerId : undefined}
            disabled={locked}
            fieldProps={{ ...field.props, onKeyDown: onScanKeyDown }}
            fieldRef={scanRef}
            onLookup={focusScan}
            value={field.query}
          />
          {searching ? (
            <SearchResults
              activeIndex={active}
              onPick={pick}
              query={field.query.trim()}
              search={search}
            />
          ) : loading && !view ? (
            <LinesSkeleton />
          ) : !view && locked ? (
            <UnavailableBasket />
          ) : rows.length === 0 ? (
            <EmptyBasket />
          ) : (
            <Lines
              disabled={busyOrLocked}
              editingId={editingId}
              listRef={listRef}
              onEditDone={() => {
                finishEdit();
                focusScan();
              }}
              onQuantity={setQuantity}
              onRemove={remove}
              onSelect={setSelectedId}
              rows={rows}
              selectedId={selected?.lineId}
            />
          )}
          <CartTotals saved={view?.draft != null} totals={totalsOf(snapshot)} />
        </section>
        <TaxSummary className="col-span-5" rows={rows} totals={totalsOf(snapshot)} />
      </div>
      <ShortcutHints />
    </main>
  );
}

const zero = money(0);
const emptyTotals = {
  base: zero,
  vat: zero,
  nhil: zero,
  getfund: zero,
  covid: zero,
  gross: zero,
  roundingAdjustment: zero,
};
const totalsOf = (snapshot: SaleSnapshot) => snapshot.view?.quote.totals ?? emptyTotals;
