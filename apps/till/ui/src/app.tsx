import "./styles.css";
import { createRoot } from "react-dom/client";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { ConnectionScreen } from "./screens/connection/screen";
import { initializeConnection } from "./connection/store";

initializeConnection();

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <AppBackdrop className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-8 lg:px-13 lg:py-10">
      <ConnectionScreen />
    </AppBackdrop>
  </ShortcutRoot>,
);
