import type { BridgeMessage } from "@shopper/sync/bridge";
import type { ReprintFeedback, SaleOutcome } from "../sale/types";
import type { ShiftPhase, ShiftStatus } from "./types";

export const lost = "The register connection ended. Reconnect and check the shift before retrying.";

/** A refused or lost shift request in the host's own words, with permission and printer faults made plain. */
export function shiftFailure(
  reply: BridgeMessage | undefined,
): Extract<SaleOutcome, { ok: false }> {
  if (reply?.type !== "error") return { ok: false, code: "CONNECTION_LOST", message: lost };
  if (reply.code === "permission" || reply.code === "scope")
    return { ok: false, code: reply.code, message: "Your role cannot do that. Ask a manager." };
  if (reply.code === "PRINTER_OFFLINE")
    return {
      ok: false,
      code: reply.code,
      message: "The printer is offline. Check its power and network, then print again.",
    };
  return { ok: false, code: reply.code, message: reply.message };
}

export const printed = (reply: BridgeMessage | undefined): ReprintFeedback => {
  if (reply?.type === "result") return { status: "done", message: null };
  return { status: "failed", message: shiftFailure(reply).message };
};

/** No shift means closed, a counted one is waiting for its close, and a host that says nothing blocks nothing. */
export function phaseOf(shift: ShiftStatus | undefined): ShiftPhase {
  if (!shift) return "unknown";
  if (!shift.current) return "closed";
  return shift.current.status === "declared" ? "counting" : "open";
}
