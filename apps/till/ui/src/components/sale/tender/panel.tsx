import { useState } from "react";
import {
  add,
  formatGHS,
  fromDecimal,
  money,
  toDecimal,
  wholePesewas,
  type Money,
} from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { SaleActions, SaleSnapshot, TenderKind } from "../../../sale/types";
import { TenderActions } from "./actions";
import { TenderHeader } from "./header";
import { TenderOverlays } from "./overlays";
import { TenderKeypad } from "./keypad";
import { TenderMethods } from "./methods";
import { previewSettlement } from "./preview";
import { MomoState, ReceiptComplete } from "./state";

export function TenderPanel({
  snapshot,
  actions,
  active = true,
  onReturnFocus,
  onPurchases,
}: {
  snapshot: SaleSnapshot;
  actions: SaleActions;
  active?: boolean;
  onReturnFocus: () => void;
  onPurchases?: () => void;
}) {
  const [amountEntry, setAmountEntry] = useState<{ draftKey: string; value: string } | null>(null);
  const [kind, setKind] = useState<TenderKind>("cash");
  const [cardOpen, setCardOpen] = useState(false);
  const [momoOpen, setMomoOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidNotice, setVoidNotice] = useState("");
  const draft = snapshot.view?.draft;
  const draftKey = draft ? `${draft.id}:${draft.revision}` : null;
  const amountText = amountEntry?.draftKey === draftKey ? amountEntry.value : null;
  const baseSettlement = snapshot.view?.settlement;
  const gross = money(baseSettlement?.gross ?? snapshot.view?.quote.totals.gross ?? 0);
  const settlement = previewSettlement(snapshot.view, gross, kind) ?? baseSettlement;
  const balance = money(settlement?.balance ?? gross);
  const settlementError = snapshot.view?.settlementError;
  const amount = parseAmount(amountText ?? toDecimal(balance));
  const canTender = amount !== null && amount > 0;
  const locked = snapshot.host !== "connected" || snapshot.failure !== null || snapshot.busy;
  const momoTenders = draft?.tenders.filter((tender) => tender.kind === "momo") ?? [];
  const momo = momoTenders.at(-1);
  const momoNotice = snapshot.paymentNotice;
  const momoFailure =
    momo && momoNotice?.reference === momo.reference && momoNotice.status === momo.status
      ? momoNotice.failureReason
      : null;
  const unappliedConfirmation =
    momoNotice?.status === "confirmed" &&
    !draft?.tenders.some((tender) => tender.reference === momoNotice.reference);
  const waitingForMomo = momoTenders.some(
    (tender) => tender.status === "pending" || tender.status === "otp",
  );
  const register = useShortcuts(
    active && !snapshot.receipt
      ? {
          "Alt+1": () => setKind("cash"),
          "Alt+2": () => openMomo(),
          "Alt+3": () => openCard(),
          "Alt+4": addCash,
          F5: charge,
          F6: hold,
          F7: showHeld,
          F11: askVoid,
        }
      : {},
  );

  function openCard() {
    setKind("card");
    setCardOpen(true);
  }
  function selectMethod(next: TenderKind) {
    if (next === "cash") setKind("cash");
    if (next === "card") openCard();
    if (next === "momo") openMomo();
  }
  function openMomo() {
    if (snapshot.sync.offline || !snapshot.permissions.includes("payment.momo")) return;
    setKind("momo");
    setMomoOpen(true);
  }
  function addCash() {
    if (canTender && !locked) actions.addTender({ kind: "cash", amount });
  }
  function charge() {
    if (locked || waitingForMomo) return;
    if (balance <= 0) {
      if (gross === 0 && draft && draft.lines.length > 0 && draft.tenders.length === 0)
        return actions.charge({ kind: "cash", amount: money(0) });
      return actions.complete();
    }
    if (kind === "card") return openCard();
    if (kind === "momo") return openMomo();
    if (canTender) actions.charge({ kind: "cash", amount });
  }
  function addCard(approvalCode: string, last4: string) {
    if (!canTender) return;
    actions.addTender({ kind: "card", amount, approvalCode, ...(last4 ? { last4 } : {}) });
    setCardOpen(false);
  }
  function requestMomo(phone: string, network: "mtn" | "telecel" | "airteltigo") {
    if (!canTender) return;
    try {
      actions.startMomo({ phone, network, amount: wholePesewas(amount) });
      setMomoOpen(false);
    } catch {
      setVoidNotice("Mobile money amount must use whole pesewas.");
    }
  }
  function addMomoOtp(otp: string) {
    if (momo?.reference) actions.submitMomoOtp({ reference: momo.reference, otp });
  }
  function hold() {
    if (locked || !draft) return;
    actions.hold();
  }
  function showHeld() {
    if (locked) return;
    actions.listHeld();
    setHeldOpen(true);
  }
  function askVoid() {
    if (!snapshot.permissions.includes("sale.void")) {
      setVoidNotice("A manager permission is required to void a sale.");
      return;
    }
    setVoidOpen(true);
  }
  function confirmVoid(reason: string) {
    actions.voidSale(reason);
    setVoidOpen(false);
  }

  if (snapshot.receipt)
    return <ReceiptComplete actions={actions} active={active} receipt={snapshot.receipt} />;

  const total = money(settlement?.total ?? gross);
  const received = settlement ? add(money(settlement.cash), money(settlement.nonCash)) : money(0);
  const chargeDisabled =
    locked ||
    !draft ||
    waitingForMomo ||
    !!settlementError ||
    (balance > 0 && (!canTender || amount < balance));
  return (
    <section
      aria-label="Tender"
      className="flex min-h-152 min-w-0 flex-col gap-3 overflow-visible rounded-lg border bg-card p-4 shadow-sm md:col-span-5 md:min-h-0 md:overflow-y-auto lg:overflow-visible"
      ref={register}
    >
      <TenderHeader
        balance={balance}
        total={total}
        received={received}
        itemCount={draft?.lines.length ?? 0}
        locked={locked}
        hasDraft={draft !== undefined}
        onHold={hold}
        onShowHeld={showHeld}
        onVoid={askVoid}
      />

      <TenderKeypad
        balance={balance}
        onChange={(value) => {
          if (draftKey) setAmountEntry({ draftKey, value });
        }}
        onEnter={charge}
        value={amountText ?? toDecimal(balance)}
      />
      {balance > 0 && amount !== null && amount < balance && (
        <p className="text-sm text-muted-foreground" role="status">
          Add another tender to finish this sale.
        </p>
      )}
      <TenderMethods
        canMomo={snapshot.permissions.includes("payment.momo")}
        offline={snapshot.sync.offline}
        onSelect={selectMethod}
        selected={kind}
      />
      {snapshot.sync.offline && (
        <p className="text-sm text-muted-foreground">Mobile money needs an internet connection.</p>
      )}
      {!snapshot.permissions.includes("payment.momo") && (
        <p className="text-sm text-muted-foreground" role="status">
          Mobile money permission is required for this register.
        </p>
      )}
      {settlementError && (
        <p
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
          role="alert"
        >
          {settlementError}
        </p>
      )}
      {unappliedConfirmation && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          role="status"
        >
          <span>MoMo confirmed — not yet applied to a sale</span>
          <Button onClick={onPurchases} size="touch" variant="outline">
            Purchases
          </Button>
        </div>
      )}
      <MomoState failureReason={momoFailure} tender={momo} onOtp={addMomoOtp} onRetry={openMomo} />
      {snapshot.operationError && (
        <p role="alert" className="text-sm text-destructive">
          {snapshot.operationError}
        </p>
      )}
      {voidNotice && (
        <p role="status" className="text-sm text-muted-foreground">
          {voidNotice}
        </p>
      )}

      <TenderActions
        amount={formatGHS(canTender ? amount : balance)}
        canSplit={!locked && canTender}
        canCharge={!chargeDisabled}
        onSplit={addCash}
        onCharge={charge}
      />

      <TenderOverlays
        amount={amount ?? money(0)}
        offline={snapshot.sync.offline}
        onReturnFocus={onReturnFocus}
        cardOpen={cardOpen}
        momoOpen={momoOpen}
        heldOpen={heldOpen}
        voidOpen={voidOpen}
        held={snapshot.held}
        onCardOpenChange={setCardOpen}
        onCardSubmit={addCard}
        onMomoOpenChange={setMomoOpen}
        onMomoSubmit={requestMomo}
        onHeldOpenChange={setHeldOpen}
        onResume={(id, revision) => {
          actions.resume(id, revision);
          setHeldOpen(false);
        }}
        canVoid={snapshot.permissions.includes("sale.void")}
        onHeldVoid={(id, revision, reason) => actions.voidSale(reason, id, revision)}
        onVoidOpenChange={setVoidOpen}
        onVoidSubmit={confirmVoid}
      />
    </section>
  );
}

function parseAmount(value: string): Money | null {
  try {
    return fromDecimal(value);
  } catch {
    return null;
  }
}
