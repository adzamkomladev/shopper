import "./styles.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { ConnectionScreen } from "./screens/connection/screen";
import { SaleScreen } from "./screens/sale/screen";
import { PurchasesScreen } from "./screens/purchases/screen";
import { TillNavigation } from "./components/navigation/screen";
import { initializeConnection } from "./connection/store";
import { saleActions, useSaleSnapshot } from "./sale/store";
import { purchaseActions, usePurchasesSnapshot } from "./purchases/store";
import type { TillView } from "./components/navigation/types";

initializeConnection();

function Register() {
  const [view, setView] = useState<"connection" | "till">("connection");
  const [tab, setTab] = useState<TillView>("sale");
  const sale = useSaleSnapshot();
  const purchases = usePurchasesSnapshot();
  function navigate(next: TillView) {
    setTab(next);
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
            onPurchases={() => navigate("purchases")}
            onRegister={() => setView("connection")}
            snapshot={sale}
          />
        </div>
        <div hidden={tab !== "purchases"} className="h-full min-h-0">
          <PurchasesScreen
            active={tab === "purchases"}
            actions={purchaseActions}
            snapshot={purchases}
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

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <Register />
  </ShortcutRoot>,
);
