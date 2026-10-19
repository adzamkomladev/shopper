import type { EligibilityView, PurchaseOutput } from "../sale/types";
import { accraDay } from "./format";

export const cannotRefund = "Your role cannot refund. Ask a manager.";
export const nothingLeft = "Nothing left to return";

/** Why Start return is unavailable, or null when it can run. */
export function returnBlock(output: PurchaseOutput | null, eligibility: EligibilityView) {
  if (!output) return "The register host is offline";
  if (!output.canRefund) return cannotRefund;
  if (!eligibility.refundable) return nothingLeft;
  return null;
}

/** The window in one line: open until a day, or closed on it. */
export const windowLine = ({ withinWindow, windowEndsAt }: EligibilityView) =>
  withinWindow
    ? `Return eligible until ${accraDay(windowEndsAt)}`
    : `Return window closed ${accraDay(windowEndsAt)}`;

/** Why a manager must approve this return, or null when the cashier may refund alone. */
export function approvalReason(eligibility: EligibilityView) {
  if (!eligibility.approvalRequired) return null;
  return eligibility.withinWindow
    ? "A manager must approve this return."
    : `The return window closed on ${accraDay(eligibility.windowEndsAt)}. A manager must approve this return.`;
}

/** Lines by what can happen to them. */
export function lineCounts(eligibility: EligibilityView) {
  const { lines } = eligibility;
  return {
    eligible: lines.filter((line) => line.status === "eligible").length,
    final: lines.filter((line) => line.status === "final").length,
    returned: lines.filter((line) => line.refundedThousandths > 0).length,
  };
}
