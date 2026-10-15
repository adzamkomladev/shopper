/// <reference types="vite-plus/client" />
import "../src/styles.css";
import { createRoot } from "react-dom/client";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { SaleScreen } from "../src/screens/sale/screen";
import type { SaleActions } from "../src/sale/types";
import { scenarios } from "./fixtures";

// Every action lands in window.saleCalls so a test can assert what the screen asked for.
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
const actions: SaleActions = {
  search: record("search"),
  add: record("add"),
  setQuantity: record("setQuantity"),
  removeLine: record("removeLine"),
  dismissFeedback: record("dismissFeedback"),
  syncNow: record("syncNow"),
  reconnect: record("reconnect"),
};
const onRegister = record("register");

const name = new URLSearchParams(location.search).get("scenario") ?? "lines";
const snapshot = scenarios[name];
if (!snapshot) throw new Error(`Unknown sale scenario ${name}`);

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <AppBackdrop className="px-11 py-8" fill>
      <SaleScreen actions={actions} onRegister={onRegister} snapshot={snapshot} />
    </AppBackdrop>
  </ShortcutRoot>,
);
