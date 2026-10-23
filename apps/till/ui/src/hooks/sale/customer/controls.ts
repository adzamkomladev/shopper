import { useState } from "react";
import type { SaleActions, SaleSnapshot } from "../../../sale/types";
import type { CustomerMode } from "./types";

/**
 * The customer on the sale: who is attached, which dialog is open and the keys that reach it. Alt+U and Alt+I
 * open it for a new customer, Alt+E edits the attached one and Alt+R takes them off.
 */
export function useCustomerControls(snapshot: SaleSnapshot, actions: SaleActions) {
  const [mode, setMode] = useState<CustomerMode | null>(null);
  const customer = snapshot.view?.customer ?? null;
  const canRead = snapshot.permissions.includes("customer.read");
  const canWrite = snapshot.permissions.includes("customer.write");
  const locked =
    snapshot.host !== "connected" ||
    snapshot.failure !== null ||
    snapshot.busy ||
    snapshot.receipt !== null;
  // The tiles say why they are off; a busy or disconnected register already says so on screen.
  const reason = canRead ? null : "Needs customer access";

  function open(next: "attach" | "invoice") {
    if (!locked && canRead) setMode(next);
  }
  function edit() {
    if (!locked && customer && canWrite) setMode("edit");
  }
  function remove() {
    if (!locked && customer) void actions.attachCustomer(null);
  }

  return {
    mode,
    customer,
    canRead,
    canWrite,
    locked,
    reason,
    offline: snapshot.sync.offline,
    open,
    edit,
    remove,
    close: () => setMode(null),
    /** Merged into the sale screen's key map while no dialog is open. */
    keys: {
      "Alt+U": () => open("attach"),
      "Alt+I": () => open("invoice"),
      "Alt+E": edit,
      "Alt+R": remove,
    },
  };
}
