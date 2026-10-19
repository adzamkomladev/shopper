/// <reference types="vite-plus/client" />
import { useState } from "react";
import "../src/styles.css";
import { createRoot } from "react-dom/client";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import {
  RegisterDashboard,
  RegisterInventory,
  RegisterProvider,
  RegisterReports,
} from "@shopper/backoffice/register";
import { ShellFrame } from "../src/components/shell/frame";
import { RegisterSlot } from "../src/components/shell/slot";
import type { ShellView } from "../src/components/shell/types";
import { landingView } from "../src/components/shell/views";
import { SaleScreen } from "../src/screens/sale/screen";
import { PurchasesScreen } from "../src/screens/purchases/screen";
import { SettingsScreen } from "../src/screens/settings/screen";
import { scenarios } from "./scenarios";
import { purchaseOutput } from "../src/purchases/delivery";
import { purchaseActions } from "./purchases/actions";
import { initialPurchases } from "./purchases/data";
import { purchasePermissions } from "./purchases/scenarios";
import { saleActions } from "./sale/actions";
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
const link =
  params.has("offline") || name === "find-offline"
    ? { label: "Offline", state: "problem" as const, online: false }
    : { label: "Connected", state: "good" as const, online: true };
const can = (permission: string) => permissions.includes(permission);
const initialSale = scenarios[name] ?? scenarios.lines!;
const printerFails = ["lines-offline", "reprint-offline"].includes(name);

function Harness() {
  const [tab, setTab] = useState<ShellView>(landingView(permissions) ?? "purchases");
  const [saleFocus, setSaleFocus] = useState(0);
  const [saleSnapshot, setSaleSnapshot] = useState(initialSale);
  const [purchases, setPurchases] = useState(() => initialPurchases(name));
  const [settings, settingsActions] = useSettingsHarness(name, record);
  const sale = saleActions(name, record, setSaleSnapshot, printerFails);
  const purchaseActionsFor = purchaseActions(name, record, setPurchases, printerFails);
  function navigate(next: ShellView) {
    setTab(next);
    if (next === "sale") setSaleFocus((value) => value + 1);
    if (next === "purchases") purchaseActionsFor.list({ ...purchases.filters, page: 1 });
  }
  return (
    <RegisterProvider>
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
            <RegisterSlot active={tab === "dashboard"} slot="register-dashboard" title="Dashboard">
              <RegisterDashboard online={link.online} onOpen={navigate} />
            </RegisterSlot>
          )}
          {can("stock.read") && (
            <RegisterSlot active={tab === "inventory"} slot="register-inventory" title="Inventory">
              <RegisterInventory online={link.online} />
            </RegisterSlot>
          )}
          {can("report.read") && (
            <RegisterSlot active={tab === "reports"} slot="register-reports" title="Sales Reports">
              <RegisterReports online={link.online} />
            </RegisterSlot>
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
              actions={purchaseActionsFor}
              online={link.online}
              output={purchaseOutput(settings.current, purchasePermissions(name))}
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
    </RegisterProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <Harness />
    <Toaster position="top-right" />
  </ShortcutRoot>,
);
