/// <reference types="vite-plus/client" />
import { useState, type Dispatch, type SetStateAction } from "react";
import "../src/styles.css";
import { createRoot } from "react-dom/client";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { ShellFrame } from "../src/components/shell/frame";
import { RegisterSlot } from "../src/components/shell/slot";
import type { ShellView } from "../src/components/shell/types";
import { landingView } from "../src/components/shell/views";
import { SaleScreen } from "../src/screens/sale/screen";
import { PurchasesScreen } from "../src/screens/purchases/screen";
import { SettingsScreen } from "../src/screens/settings/screen";
import type {
  PurchaseActions,
  SaleActions,
  ReceiptPrint,
  ReprintFeedback,
  SaleSnapshot,
} from "../src/sale/types";
import { scenarios } from "./scenarios";
import { printFailure, purchaseOutput } from "../src/purchases/delivery";
import { initialPurchases, purchaseDetailsFor } from "./purchases";
import { addTender } from "./sale/tenders";
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
const params = new URLSearchParams(location.search);
const name = params.get("scenario") ?? "lines";
// The shell specs sign in as other staff (`?permissions=report.read,stock.read`) or lose the server (`?offline`).
const permissions = params.get("permissions")?.split(",") ?? [
  "sale.create",
  "report.read",
  "stock.read",
];
const link = params.has("offline")
  ? { label: "Offline", state: "problem" as const, online: false }
  : { label: "Connected", state: "good" as const, online: true };
const can = (permission: string) => permissions.includes(permission);
const initialSale = scenarios[name] ?? scenarios.lines!;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const printerFails = ["lines-offline", "reprint-offline"].includes(name);
const refused = "connection refused (192.168.1.50:9100)";

function Harness() {
  const [tab, setTab] = useState<ShellView>(landingView(permissions) ?? "purchases");
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
  function navigate(next: ShellView) {
    setTab(next);
    if (next === "sale") setSaleFocus((value) => value + 1);
    if (next === "purchases") purchaseActions.list({ ...purchases.filters, page: 1 });
  }
  return (
    <ShellFrame
      link={link}
      onSignOut={record("signOut")}
      onView={navigate}
      permissions={permissions}
      registerName="Till 1"
      user="Ama Mensah"
      view={tab}
    >
      <>
        {can("report.read") && (
          <RegisterSlot active={tab === "dashboard"} slot="register-dashboard" title="Dashboard" />
        )}
        {can("stock.read") && (
          <RegisterSlot active={tab === "inventory"} slot="register-inventory" title="Inventory" />
        )}
        {can("report.read") && (
          <RegisterSlot active={tab === "reports"} slot="register-reports" title="Sales Reports" />
        )}
        {can("sale.create") && (
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
        )}
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
      </>
    </ShellFrame>
  );
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
