import { useRef, useState } from "react";
import { toast } from "@shopper/ui/components/sonner";
import type { ShiftDialog, ShiftPhase } from "../../../shift/types";

/** Why a cash movement or an open cannot start now, or null when it can. */
export function whyBlocked(dialog: ShiftDialog, phase: ShiftPhase) {
  if (dialog === "open")
    return phase === "open" || phase === "counting" ? "A shift is already open" : null;
  if (phase === "closed") return "Register closed. Open a shift";
  if (phase === "counting") return "The drawer is counted. Close the shift";
  return null;
}

/** Which shift dialog is open. A blocked one says why in a toast instead of opening an action that would fail. */
export function useShiftDialogs(phase: ShiftPhase) {
  const [dialog, setDialog] = useState<ShiftDialog | null>(null);
  const opener = useRef<Element | null>(null);
  return {
    dialog,
    start: (next: ShiftDialog) => {
      // One dialog at a time: a second key must not swap the open one and lose what was typed.
      if (dialog !== null) return;
      const reason = whyBlocked(next, phase);
      if (reason) return toast.error(reason);
      opener.current = document.activeElement;
      setDialog(next);
    },
    close: () => setDialog(null),
    /** A dialog with no trigger hands focus back to what held it, or to `fallback` when that is gone. */
    restore: (event: Event, fallback: () => void) => {
      event.preventDefault();
      if (opener.current instanceof HTMLElement && opener.current.isConnected)
        opener.current.focus();
      else fallback();
    },
  };
}
