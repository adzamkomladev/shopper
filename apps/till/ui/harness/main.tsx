/// <reference types="vite-plus/client" />
import { useState, type Dispatch, type SetStateAction } from "react";
import { settle } from "@shopper/core/till/settlement";
import { money } from "@shopper/money";
import "../src/styles.css";
import { createRoot } from "react-dom/client";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { TillNavigation } from "../src/components/navigation/screen";
import type { TillView } from "../src/components/navigation/types";
import { SaleScreen } from "../src/screens/sale/screen";
import { PurchasesScreen } from "../src/screens/purchases/screen";
import { SettingsScreen } from "../src/screens/settings/screen";
import type {
  DraftTender,
  PurchaseActions,
  SaleActions,
  ReceiptPrint,
  ReprintFeedback,
  SaleSnapshot,
  TenderInput,
} from "../src/sale/types";
import { scenarios } from "./scenarios";
import { printFailure, purchaseOutput } from "../src/purchases/delivery";
import { initialPurchases, purchaseDetailsFor } from "./purchases";
import { useSettingsHarness } from "./settings";

declare global {
  interface Window {
    saleCalls: { type: string; args: unknown[] }[];
  }
}
window.saleCalls = [];

const record =
  (type: string) =>
  (...args: unknown[]) =>
    window.saleCalls.push({ type, args });
const name = new URLSearchParams(location.search).get("scenario") ?? "lines";
const initialSale = scenarios[name] ?? scenarios.lines!;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const printerFails = ["lines-offline", "reprint-offline"].includes(name);
const refused = "connection refused (192.168.1.50:9100)";

function Harness() {
  const [tab, setTab] = useState<TillView>("sale");
  const [saleFocus, setSaleFocus] = useState(0);
  const [saleSnapshot, setSaleSnapshot] = useState(initialSale);
  const [purchases, setPurchases] = useState(() => initialPurchases(name));
  const [settings, settingsActions] = useSettingsHarness(name, record);
  const sale: SaleActions = {
    search: record("search"),
    add: record("add"),
    setQuantity: record("setQuantity"),
    removeLine: record("removeLine"),
    addTender: (input) => {
      record("addTender")(input);
      setSaleSnapshot((current) => addTender(current, input));
    },
    charge: (input) => {
      record("charge")(input);
      completeSale(setSaleSnapshot, name === "lines-slowprint" ? 1500 : 120);
    },
    complete: () => {
      record("complete")();
      completeSale(setSaleSnapshot, 120);
    },
    removeTender: record("removeTender"),
    startMomo: (input) => {
      record("startMomo")(input);
      setSaleSnapshot((current) => ({ ...current, view: scenarios["momo-otp"]!.view }));
    },
    submitMomoOtp: (input) => {
      record("submitMomoOtp")(input);
      setSaleSnapshot((current) => ({ ...current, view: scenarios["momo-confirmed"]!.view }));
    },
    hold: record("holdSale"),
    listHeld: record("listHeld"),
    resume: record("resumeSale"),
    voidSale: (reason, draftId, revision) => {
      record("voidSale")(reason, draftId, revision);
      if (draftId)
        setSaleSnapshot((current) => ({
          ...current,
          held: current.held.filter((view) => view.draft?.id !== draftId),
        }));
    },
    newSale: () => {
      record("newSale")();
      const initial = scenarios.lines!;
      const view = initial.view;
      setSaleSnapshot(
        view?.draft
          ? {
              ...initial,
              view: {
                ...view,
                draft: { ...view.draft, id: "10000000-0000-7000-8000-000000000101", revision: 0 },
              },
            }
          : initial,
      );
    },
    newSaleWith: (input) => {
      record("newSaleWith")(input);
      sale.newSale();
    },
    print: async (saleId) => {
      record("print")(saleId);
      await sleep(300);
      const failed = printerFails;
      setSaleSnapshot((current) => withPrint(current, saleId, failed ? "failed" : "printed"));
      return failed
        ? { status: "failed", message: printFailure(refused) }
        : { status: "done", message: null };
    },
    dismissFeedback: record("dismissFeedback"),
    syncNow: record("syncNow"),
    reconnect: record("reconnect"),
  };
  const purchaseActions: PurchaseActions = {
    list: (filters) => {
      window.saleCalls.push({ type: "listPurchases", args: [filters] });
      setPurchases((current) => ({
        ...current,
        filters,
        status: current.status === "loading" ? "loading" : current.status,
      }));
    },
    read: (saleId) => {
      window.saleCalls.push({ type: "readPurchase", args: [saleId] });
      setPurchases((current) => ({
        ...current,
        selected: purchaseDetailsFor(name),
        reprint: null,
      }));
    },
    clear: () => {
      window.saleCalls.push({ type: "clearPurchase", args: [] });
      setPurchases((current) => ({ ...current, selected: null, reprint: null }));
    },
    reprint: async (saleId) => {
      record("reprint")(saleId);
      const change = (reprint: ReprintFeedback) =>
        setPurchases((current) => ({ ...current, reprint }));
      change({ status: "running", message: null });
      await sleep(name === "reprint-slow" ? 1500 : 300);
      if (printerFails) {
        const failed: ReprintFeedback = { status: "failed", message: printFailure(refused) };
        change(failed);
        return failed;
      }
      const done: ReprintFeedback = { status: "done", message: null };
      setPurchases((current) => ({
        ...current,
        reprint: done,
        selected: current.selected?.delivery
          ? {
              ...current.selected,
              delivery: {
                ...current.selected.delivery,
                printedAt: current.selected.delivery.printedAt ?? new Date().toISOString(),
                printError: null,
                reprints: current.selected.delivery.reprints + 1,
              },
            }
          : current.selected,
      }));
      return done;
    },
  };
  function navigate(next: TillView) {
    setTab(next);
    if (next === "sale") setSaleFocus((value) => value + 1);
    if (next === "purchases") purchaseActions.list({ ...purchases.filters, page: 1 });
  }
  return (
    <AppBackdrop className="flex min-h-0 flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-11 lg:py-8" fill>
      <TillNavigation view={tab} onChange={navigate} />
      <div className="min-h-0 flex-1">
        <div className="h-full min-h-0" hidden={tab !== "sale"}>
          <SaleScreen
            active={tab === "sale"}
            actions={sale}
            focusKey={saleFocus}
            onPurchases={() => navigate("purchases")}
            onRegister={record("register")}
            snapshot={saleSnapshot}
          />
        </div>
        <div className="h-full min-h-0" hidden={tab !== "purchases"}>
          <PurchasesScreen
            active={tab === "purchases"}
            actions={purchaseActions}
            output={purchaseOutput(
              settings.current,
              name === "reprint-nopermission" ? [] : ["sale.create"],
            )}
            snapshot={purchases}
          />
        </div>
        <div className="h-full min-h-0" hidden={tab !== "settings"}>
          <SettingsScreen
            active={tab === "settings"}
            actions={settingsActions}
            snapshot={settings}
          />
        </div>
      </div>
    </AppBackdrop>
  );
}

function addTender(snapshot: SaleSnapshot, input: TenderInput): SaleSnapshot {
  const view = snapshot.view;
  const draft = view?.draft;
  if (!view || !draft) return snapshot;
  const tender: DraftTender = {
    id: "10000000-0000-7000-8000-000000000010",
    orgId: "10000000-0000-7000-8000-000000000002",
    draftId: draft.id,
    position: draft.tenders.length,
    kind: input.kind,
    amount: input.amount,
    reference: null,
    approvalCode: input.kind === "card" ? input.approvalCode : null,
    last4: input.kind === "card" ? (input.last4 ?? null) : null,
    phone: null,
    network: null,
    status: "applied",
    createdAt: "2026-10-15T09:30:00.000Z",
  };
  const tenders = [...draft.tenders, tender];
  const settlement = settle(money(view.quote.totals.gross), tenders, view.cashRounding ?? "none");
  return {
    ...snapshot,
    view: {
      ...view,
      draft: { ...draft, tenders, revision: draft.revision + 1 },
      settlement,
    },
  };
}

/** Completes the sale, then plays out the automatic print after `delay` ms. */
function completeSale(setSnapshot: Dispatch<SetStateAction<SaleSnapshot>>, delay: number) {
  const receipt = scenarios.complete!.receipt!;
  const pending = { saleId: receipt.saleId, outcome: null, message: null };
  setSnapshot((current) => ({ ...current, view: null, receipt, receiptPrint: pending }));
  setTimeout(
    () =>
      setSnapshot((current) => {
        const register = current.register;
        if (!register?.printAutomatically || register.printer.state === "unconfigured")
          return current;
        const outcome =
          name === "lines-stuck"
            ? "unknown"
            : register.printer.state === "offline"
              ? "failed"
              : "printed";
        return withPrint(current, receipt.saleId, outcome);
      }),
    delay,
  );
}

function withPrint(
  snapshot: SaleSnapshot,
  saleId: string,
  outcome: NonNullable<ReceiptPrint["outcome"]>,
): SaleSnapshot {
  const message = outcome === "failed" ? printFailure(refused) : null;
  return { ...snapshot, receiptPrint: { saleId, outcome, message } };
}

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <Harness />
    <Toaster position="top-right" />
  </ShortcutRoot>,
);
