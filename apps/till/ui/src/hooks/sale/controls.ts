import { useState } from "react";
import { takenTender } from "../../sale/void";
import type { Approval, SaleActions, SaleControls, SaleSnapshot } from "../../sale/types";

/** Hold, held sales and void: one set of sale-level controls for the tiles, Clear cart and F6, F7 and F11. */
export function useSaleControls(snapshot: SaleSnapshot, actions: SaleActions): SaleControls {
  const [heldOpen, setHeldOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const hasDraft = snapshot.view?.draft != null;
  const locked = snapshot.host !== "connected" || snapshot.failure !== null || snapshot.busy;
  // Cash or card already taken means only a manager can undo the sale, whatever the cashier may do.
  const voidApproval =
    takenTender(snapshot.view?.draft ?? null) ??
    (snapshot.permissions.includes("sale.void") ? null : "permission");

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
    if (voidApproval) actions.loadApprovers("sale.void");
    setVoidOpen(true);
  }
  async function confirmVoid(reason: string, approval?: Approval) {
    const outcome = await actions.voidSale(reason, undefined, undefined, approval);
    if (outcome.ok) setVoidOpen(false);
    return outcome;
  }

  return {
    hasDraft,
    locked,
    heldOpen,
    voidOpen,
    voidApproval,
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
