import { useState } from "react";
import { add, formatGHS, money, wholePesewas } from "@shopper/money";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useAccountRead } from "../../../hooks/sale/tender/account";
import { tenderEntry } from "../../../sale/account/entry";
import { pointsText } from "../../../sale/account/rules";
import { hasUnappliedConfirmation } from "../../../sale/payments";
import type { TenderMethod } from "../../../sale/account/types";
import type { SaleActions, SaleControls, SaleSnapshot } from "../../../sale/types";
import { TenderActions } from "./actions";
import { AccountNotice, AccountSummary, PointsEntry } from "./account";
import { TenderHeader } from "./header";
import { TenderOverlays } from "./overlays";
import { TenderKeypad } from "./keypad";
import { methodReasons, TenderMethods } from "./methods";
import { previewSettlement } from "./preview";
import { MomoState, ReceiptComplete, UnappliedConfirmation } from "./state";

export function TenderPanel({
  snapshot,
  actions,
  active = true,
  controls,
  hidden = false,
  onBack,
  onReturnFocus,
  onPurchases,
}: {
  snapshot: SaleSnapshot;
  actions: SaleActions;
  active?: boolean;
  controls: SaleControls;
  /** The cart is showing instead; the panel stays mounted so Alt+1 to Alt+4 and F5 keep working. */
  hidden?: boolean;
  onBack: () => void;
  onReturnFocus: () => void;
  onPurchases?: () => void;
}) {
  const [amountEntry, setAmountEntry] = useState<{ draftKey: string; value: string } | null>(null);
  const [pointsEntry, setPointsEntry] = useState<{ draftKey: string; value: string } | null>(null);
  const [picked, setKind] = useState<TenderMethod>("cash");
  const [cardOpen, setCardOpen] = useState(false);
  const [momoOpen, setMomoOpen] = useState(false);
  const draft = snapshot.view?.draft;
  const draftKey = draft ? `${draft.id}:${draft.revision}` : null;
  const amountText = amountEntry?.draftKey === draftKey ? amountEntry.value : null;
  const baseSettlement = snapshot.view?.settlement;
  const gross = money(baseSettlement?.gross ?? snapshot.view?.quote.totals.gross ?? 0);
  const customer = snapshot.view?.customer ?? null;
  const account = useAccountRead(customer?.id ?? null, actions);
  const reasons = methodReasons({
    offline: snapshot.sync.offline,
    canMomo: snapshot.permissions.includes("payment.momo"),
    hasCustomer: customer !== null,
  });
  // Removing the customer or losing the connection takes the account methods away, so the step falls back to cash.
  const kind = (picked === "credit" || picked === "loyalty") && reasons.account ? "cash" : picked;
  const accountKind = kind === "credit" || kind === "loyalty" ? kind : null;
  const settlement = previewSettlement(snapshot.view, gross, kind) ?? baseSettlement;
  const balance = money(settlement?.balance ?? gross);
  const settlementError = snapshot.view?.settlementError;
  const entry = tenderEntry({
    kind,
    account: account.account,
    balance,
    amountText,
    pointsText: pointsEntry?.draftKey === draftKey ? pointsEntry.value : null,
  });
  const { amount, points } = entry;
  const canTender = amount !== null && amount > 0;
  const { locked } = controls;
  const momoTenders = draft?.tenders.filter((tender) => tender.kind === "momo") ?? [];
  const momo = momoTenders.at(-1);
  const momoNotice = snapshot.paymentNotice;
  const momoFailure =
    momo && momoNotice?.reference === momo.reference && momoNotice.status === momo.status
      ? momoNotice.failureReason
      : null;
  const unappliedConfirmation = hasUnappliedConfirmation(snapshot);
  const waitingForMomo = momoTenders.some(
    (tender) => tender.status === "pending" || tender.status === "otp",
  );
  const register = useShortcuts(
    active && !snapshot.receipt
      ? {
          "Alt+1": () => setKind("cash"),
          "Alt+2": () => openMomo(),
          "Alt+3": () => openCard(),
          "Alt+4": split,
          "Alt+5": () => openAccount("credit"),
          "Alt+6": () => openAccount("loyalty"),
          F5: charge,
        }
      : {},
  );

  function openCard() {
    setKind("card");
    setCardOpen(true);
  }
  function selectMethod(next: TenderMethod) {
    if (next === "cash") setKind("cash");
    if (next === "card") openCard();
    if (next === "momo") openMomo();
    if (next === "credit" || next === "loyalty") openAccount(next);
  }
  /** Reads what the customer may spend each time, since another register may have used it. */
  function openAccount(next: "credit" | "loyalty") {
    if (reasons.account || locked) return;
    setKind(next);
    account.clearRefusal();
    void account.load(account.read?.status === "ready");
  }
  function split() {
    if (accountKind) void addAccount(false);
    else addCash();
  }
  /** Puts the account tender on the basket, then completes the sale when it covered what was due. */
  async function addAccount(thenComplete: boolean) {
    if (locked || !canTender || entry.blocked) return;
    const added = await account.add(
      kind === "loyalty" ? { kind, points: points! } : { kind: "credit", amount },
    );
    if (added && thenComplete) actions.complete();
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
    if (accountKind)
      return amount !== null && amount >= balance ? void addAccount(true) : undefined;
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
      controls.setNotice("Mobile money amount must use whole pesewas.");
    }
  }
  function addMomoOtp(otp: string) {
    if (momo?.reference) actions.submitMomoOtp({ reference: momo.reference, otp });
  }
  if (snapshot.receipt)
    return (
      <ReceiptComplete
        actions={actions}
        active={active}
        receipt={snapshot.receipt}
        print={snapshot.receiptPrint}
        register={snapshot.register}
      />
    );

  const total = money(settlement?.total ?? gross);
  const received = settlement ? add(money(settlement.cash), money(settlement.nonCash)) : money(0);
  const chargeDisabled =
    locked ||
    !draft ||
    waitingForMomo ||
    !!settlementError ||
    entry.blocked ||
    (balance > 0 && (!canTender || amount < balance));
  return (
    <section
      aria-label="Tender"
      className="flex min-h-152 min-w-0 flex-1 flex-col gap-3 overflow-visible rounded-panel border bg-card p-4 shadow-sm md:min-h-0 md:overflow-y-auto lg:overflow-visible"
      hidden={hidden}
      ref={register}
    >
      <TenderHeader
        balance={balance}
        total={total}
        received={received}
        itemCount={draft?.lines.length ?? 0}
        onBack={onBack}
      />

      {accountKind && (
        <AccountSummary
          kind={accountKind}
          onRetry={() => void account.load()}
          read={account.read}
        />
      )}
      {kind === "loyalty" ? (
        <PointsEntry
          account={account.account}
          onChange={(value) => {
            account.clearRefusal();
            if (draftKey) setPointsEntry({ draftKey, value: pointsText(value) });
          }}
          onEnter={charge}
          points={points}
          value={entry.pointsInput}
        />
      ) : (
        <TenderKeypad
          balance={balance}
          pad={kind !== "credit"}
          onChange={(value) => {
            account.clearRefusal();
            if (draftKey) setAmountEntry({ draftKey, value });
          }}
          onEnter={charge}
          value={entry.amountInput}
        />
      )}
      <AccountNotice problem={entry.issue ?? account.refusal} />
      {balance > 0 && amount !== null && amount < balance && (
        <p className="text-sm text-muted-foreground" role="status">
          Add another tender to finish this sale.
        </p>
      )}
      <TenderMethods onSelect={selectMethod} reasons={reasons} selected={kind} />
      {settlementError && (
        <p
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
          role="alert"
        >
          {settlementError}
        </p>
      )}
      {unappliedConfirmation && <UnappliedConfirmation onPurchases={onPurchases} />}
      <MomoState failureReason={momoFailure} tender={momo} onOtp={addMomoOtp} onRetry={openMomo} />
      {snapshot.operationError && (
        <p role="alert" className="text-sm text-destructive">
          {snapshot.operationError}
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
        heldOpen={controls.heldOpen}
        voidOpen={controls.voidOpen}
        voidApproval={controls.voidApproval}
        approvers={snapshot.approvers}
        held={snapshot.held}
        onCardOpenChange={setCardOpen}
        onCardSubmit={addCard}
        onMomoOpenChange={setMomoOpen}
        onMomoSubmit={requestMomo}
        onHeldOpenChange={controls.setHeldOpen}
        onResume={(id, revision) => {
          actions.resume(id, revision);
          controls.setHeldOpen(false);
        }}
        canVoid={snapshot.permissions.includes("sale.void")}
        onHeldVoid={(id, revision, reason, approval) =>
          actions.voidSale(reason, id, revision, approval)
        }
        onVoidOpenChange={controls.setVoidOpen}
        onVoidSubmit={controls.confirmVoid}
        onRetryApprovers={() => actions.loadApprovers("sale.void")}
      />
    </section>
  );
}
