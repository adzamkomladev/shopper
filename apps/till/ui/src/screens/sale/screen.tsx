import { useRef, useState } from "react";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useSaleControls } from "../../hooks/sale/controls";
import { useScanField } from "../../hooks/scanner";
import { CartPanel } from "../../components/sale/cart/panel";
import { Lines } from "../../components/sale/lines";
import { SaleHeader } from "../../components/sale/header";
import { ShortcutHints } from "../../components/sale/hints";
import { addInputFor, ScanEntry, SearchResults } from "../../components/sale/search";
import { SaleTiles } from "../../components/sale/tiles";
import {
  EmptyBasket,
  CompletedBasket,
  LinesSkeleton,
  SaleBanners,
  UnavailableBasket,
} from "../../components/sale/states";
import { TenderPanel } from "../../components/sale/tender/panel";
import { hasUnappliedConfirmation } from "../../sale/payments";
import { isPriced, rowsOf, selectedRow } from "../../sale/rows";
import type { CatalogueMatch, SaleActions, SaleSnapshot } from "../../sale/types";

const bannerId = "sale-banner";
const panel =
  "flex min-h-96 flex-1 flex-col overflow-hidden rounded-panel border bg-card shadow-sm lg:min-h-0";

/**
 * The cashier workspace. It draws one snapshot and reports intent through `actions`; it fetches
 * nothing. `onRegister` returns to the register connection screen.
 */
export function SaleScreen({
  snapshot,
  actions,
  onRegister,
  onPurchases,
  active: screenActive = true,
  focusKey = 0,
}: {
  snapshot: SaleSnapshot;
  actions: SaleActions;
  onRegister: () => void;
  onPurchases?: () => void;
  active?: boolean;
  /** Changes whenever the cashier comes back to this tab, so the scan field takes focus again. */
  focusKey?: number;
}) {
  const { host, view, failure, busy, search, loading, sync } = snapshot;
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The draft the cashier pressed Checkout on, so a new, held or resumed sale starts back at the cart.
  const [tenderingFor, setTenderingFor] = useState<string | null>(null);
  // The completed sale whose scan was refused, so the message goes with that sale and not the next.
  const [refusedFor, setRefusedFor] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // On the completion view a scan or keyed code starts a new sale only with "clear cart after a sale" on.
  const startsOnScan = snapshot.receipt !== null && !!snapshot.register?.clearCartAfterSale;
  const controls = useSaleControls(snapshot, actions);
  const locked = host !== "connected" || failure !== null;
  const rows = rowsOf(view);
  const selected = selectedRow(rows, selectedId);
  const matches = search.matches;
  const active = Math.min(activeIndex, matches.length - 1);

  /** A code arriving on the completion view: it starts the next sale, or is refused out loud. */
  function codeOnCompletion(code: string) {
    if (startsOnScan) actions.newSaleWith({ code });
    else setRefusedFor(snapshot.receipt?.saleId ?? null);
  }

  const field = useScanField({
    onScan: (code) => (snapshot.receipt ? codeOnCompletion(code) : actions.add({ code })),
    onSearch: (text) => {
      setActiveIndex(0);
      actions.search(text);
    },
    onEnter: (text) => {
      if (snapshot.receipt) {
        if (text) codeOnCompletion(text);
        field.clear();
        return;
      }
      const match = matches[active];
      // A reply for older text may still be on its way; Enter never adds from it.
      if (match && search.query === text) pick(match);
    },
  });
  const searching = field.query.trim() !== "";
  const busyOrLocked = locked || busy;
  const draftId = view?.draft?.id ?? null;
  // Tenders already on the sale, or a MoMo payment waiting for one, keep the tender step showing.
  const tendering =
    snapshot.receipt === null &&
    ((draftId !== null && tenderingFor === draftId) ||
      (view?.draft?.tenders.length ?? 0) > 0 ||
      hasUnappliedConfirmation(snapshot));

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

  function checkout() {
    if (busyOrLocked || rows.length === 0) return;
    setTenderingFor(draftId);
    scanRef.current?.focus();
  }

  function backToCart() {
    setTenderingFor(null);
    focusScan();
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

  const registerShortcuts = useShortcuts(
    screenActive && !snapshot.receipt
      ? {
          F2: focusScan,
          F3: () => listRef.current?.focus(),
          F4: startEdit,
          F6: controls.hold,
          F7: controls.showHeld,
          F11: controls.askVoid,
          "Mod+Enter": checkout,
          "Alt+C": backToCart,
          F8: () => sync.canSync && actions.syncNow(),
          F9: actions.reconnect,
          F10: onRegister,
          Escape: escape,
        }
      : {},
  );
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
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto lg:grid-cols-12 lg:overflow-hidden">
        <section aria-label="Add items" className="flex min-h-0 flex-col gap-4 lg:col-span-7">
          <ScanEntry
            activeIndex={searching && matches.length > 0 ? active : null}
            describedBy={locked ? bannerId : undefined}
            disabled={locked}
            focusKey={focusKey * 2 + Number(snapshot.receipt !== null)}
            fieldProps={{ ...field.props, onKeyDown: onScanKeyDown }}
            fieldRef={scanRef}
            onLookup={focusScan}
            value={field.query}
          />
          {snapshot.receipt ? (
            <div className={panel}>
              <CompletedBasket
                refused={refusedFor === snapshot.receipt.saleId}
                startsOnScan={startsOnScan}
              />
            </div>
          ) : searching ? (
            <div className={panel}>
              <SearchResults
                activeIndex={active}
                onPick={pick}
                query={field.query.trim()}
                search={search}
              />
            </div>
          ) : (
            <SaleTiles controls={controls} onScan={focusScan} />
          )}
        </section>
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-5">
          {controls.notice && (
            <p className="text-sm text-muted-foreground" role="status">
              {controls.notice}
            </p>
          )}
          <CartPanel
            canCheckout={!busyOrLocked && rows.length > 0}
            canClear={!busyOrLocked && controls.hasDraft}
            count={view?.draft?.lines.length ?? 0}
            disabled={busyOrLocked}
            editing={selected !== undefined && editingId === selected.lineId}
            hidden={tendering || snapshot.receipt !== null}
            onCheckout={checkout}
            onClear={controls.askVoid}
            onEditDone={() => {
              finishEdit();
              focusScan();
            }}
            onQuantity={(thousandths) => selected && setQuantity(selected.lineId, thousandths)}
            onRemove={() => selected && remove(selected.lineId)}
            saved={view?.draft != null}
            selected={selected}
            totals={view?.quote.totals}
          >
            {loading && !view ? (
              <LinesSkeleton />
            ) : !view && locked ? (
              <UnavailableBasket />
            ) : rows.length === 0 ? (
              <EmptyBasket />
            ) : (
              <Lines
                disabled={busyOrLocked}
                listRef={listRef}
                onRemove={remove}
                onSelect={setSelectedId}
                revealSelected={selectedId !== null}
                rows={rows}
                selectedId={selected?.lineId}
              />
            )}
          </CartPanel>
          <TenderPanel
            active={screenActive}
            actions={actions}
            controls={controls}
            hidden={!tendering}
            onBack={backToCart}
            onReturnFocus={focusScan}
            onPurchases={onPurchases}
            snapshot={snapshot}
          />
        </div>
      </div>
      <ShortcutHints />
    </main>
  );
}
