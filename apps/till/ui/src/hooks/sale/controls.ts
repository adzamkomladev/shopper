import { useState } from "react";
import type { SaleActions, SaleControls, SaleSnapshot } from "../../sale/types";

/** Hold, held sales and void: one set of sale-level controls for the tiles, Clear cart and F6, F7 and F11. */
export function useSaleControls(snapshot: SaleSnapshot, actions: SaleActions): SaleControls {
  const [heldOpen, setHeldOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const hasDraft = snapshot.view?.draft != null;
  const locked = snapshot.host !== "connected" || snapshot.failure !== null || snapshot.busy;

  function hold() {
    if (locked || !hasDraft) return;
    actions.hold();
  }
  function showHeld() {
    if (locked) return;
    actions.listHeld();
    setHeldOpen(true);
  }
  function askVoid() {
    if (!snapshot.permissions.includes("sale.void")) {
      setNotice("A manager permission is required to void a sale.");
      return;
    }
    setVoidOpen(true);
  }
  function confirmVoid(reason: string) {
    actions.voidSale(reason);
    setVoidOpen(false);
  }

  return {
    hasDraft,
    locked,
    heldOpen,
    voidOpen,
    notice,
    hold,
    showHeld,
    askVoid,
    confirmVoid,
    setHeldOpen,
    setVoidOpen,
    setNotice,
  };
}
