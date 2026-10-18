import "./styles.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { DisplayScreen } from "./screens/display/screen";
import { ConnectionScreen } from "./screens/connection/screen";
import { SaleScreen } from "./screens/sale/screen";
import { PurchasesScreen } from "./screens/purchases/screen";
import { SettingsScreen } from "./screens/settings/screen";
import { TillNavigation } from "./components/navigation/screen";
import { initializeConnection } from "./connection/store";
import { initializeDisplay, useDisplaySnapshot } from "./display/store";
import { saleActions, useSaleSnapshot } from "./sale/store";
import { purchaseOutput } from "./purchases/delivery";
import { purchaseActions, usePurchasesSnapshot } from "./purchases/store";
import { settingsActions, useSettingsSnapshot } from "./settings/store";
import type { TillView } from "./components/navigation/types";

const display = new URLSearchParams(window.location.search).has("display");
initializeConnection();
if (display) initializeDisplay();

function Register() {
  const [view, setView] = useState<"connection" | "till">("connection");
  const [tab, setTab] = useState<TillView>("sale");
  const [saleFocus, setSaleFocus] = useState(0);
  const sale = useSaleSnapshot();
  const purchases = usePurchasesSnapshot();
  const settings = useSettingsSnapshot();
  function navigate(next: TillView) {
    setTab(next);
    if (next === "sale") setSaleFocus((value) => value + 1);
    if (next === "purchases") purchaseActions.list({ ...purchases.filters, page: 1 });
  }
  return view === "till" ? (
    <AppBackdrop className="flex min-h-0 flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-11 lg:py-8" fill>
      <TillNavigation view={tab} onChange={navigate} />
      <div className="min-h-0 flex-1">
        <div hidden={tab !== "sale"} className="h-full min-h-0">
          <SaleScreen
            active={tab === "sale"}
            actions={saleActions}
            focusKey={saleFocus}
            onPurchases={() => navigate("purchases")}
            onRegister={() => setView("connection")}
            snapshot={sale}
          />
        </div>
        <div hidden={tab !== "purchases"} className="h-full min-h-0">
          <PurchasesScreen
            active={tab === "purchases"}
            actions={purchaseActions}
            output={purchaseOutput(settings.current, sale.permissions)}
            snapshot={purchases}
          />
        </div>
        <div hidden={tab !== "settings"} className="h-full min-h-0">
          <SettingsScreen
            active={tab === "settings"}
            actions={settingsActions}
            snapshot={settings}
          />
        </div>
      </div>
    </AppBackdrop>
  ) : (
    <AppBackdrop className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-8 lg:px-13 lg:py-10">
      <ConnectionScreen onSell={() => setView("till")} />
    </AppBackdrop>
  );
}

function Display() {
  return <DisplayScreen snapshot={useDisplaySnapshot()} />;
}

// The Electron customer-display window opens this same UI with `?display`.
createRoot(document.getElementById("root")!).render(
  display ? (
    <Display />
  ) : (
    <ShortcutRoot>
      <Register />
      <Toaster position="top-right" />
    </ShortcutRoot>
  ),
);
