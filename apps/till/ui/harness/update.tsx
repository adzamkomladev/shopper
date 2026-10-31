/// <reference types="vite-plus/client" />
import "../src/styles.css";
import { createRoot } from "react-dom/client";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import type { UpdateStatus } from "@shopper/sync/bridge";
import { UpdateScreen } from "../src/screens/update/screen";

declare global {
  interface Window {
    updateCalls: string[];
  }
}
window.updateCalls = [];

// Test-only: the Update required screen without a host. `?scenario=` is the updater's state, or `offline`.
const scenario = new URLSearchParams(location.search).get("scenario") ?? "checking";
const state = scenario === "offline" ? "error" : (scenario as UpdateStatus["state"]);
const update: UpdateStatus = {
  state,
  version: state === "checking" ? null : "0.2.0",
  percent: state === "downloading" ? 42 : state === "ready" ? 100 : null,
  required: true,
  minVersion: "0.2.0",
  channel: "stable",
};
const call = (name: string) => () => window.updateCalls.push(name);

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <UpdateScreen
      offline={scenario === "offline"}
      onRestart={call("install")}
      onRetry={call("check")}
      onSignOut={call("signOut")}
      update={update}
    />
  </ShortcutRoot>,
);
