import "./styles.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { ConnectionScreen } from "./screens/connection/screen";
import { SaleScreen } from "./screens/sale/screen";
import { initializeConnection } from "./connection/store";
import { saleActions, useSaleSnapshot } from "./sale/store";

initializeConnection();

function Register() {
  const [view, setView] = useState<"connection" | "sale">("connection");
  const sale = useSaleSnapshot();
  return view === "sale" ? (
    <AppBackdrop className="px-11 py-8" fill>
      <SaleScreen actions={saleActions} onRegister={() => setView("connection")} snapshot={sale} />
    </AppBackdrop>
  ) : (
    <AppBackdrop className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-8 lg:px-13 lg:py-10">
      <ConnectionScreen onSell={() => setView("sale")} />
    </AppBackdrop>
  );
}

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <Register />
  </ShortcutRoot>,
);
