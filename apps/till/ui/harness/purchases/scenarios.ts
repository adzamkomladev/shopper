import type { Scenario } from "./types";

const scenarios: Record<string, Scenario> = {
  return: {},
  "return-approval": { approval: true },
  "return-window": { windowClosed: true, approval: true },
  "return-final": { lines: { 2: "returned", 3: "final" } },
  "return-history": { history: true, lines: { 1: "partial" } },
  "return-nothing": { lines: { 0: "returned", 1: "returned", 2: "returned", 3: "final" } },
  "return-gone": { preview: "gone" },
  "return-loading": { preview: "loading" },
  "return-offline": { server: true, preview: "offline" },
  "return-server": { server: true },
  "return-rejected": {
    refundError: {
      code: "REFUND_CONFLICT",
      message: "Another register refunded this line first. Check the purchase and try again.",
    },
  },
  "return-nopermission": { noRefund: true },
  "find-server": { lookup: "found" },
  "find-missing": { lookup: "missing" },
  "find-offline": { lookup: "offline" },
  "find-failed": { lookup: "failed" },
};
export const scenarioOf = (name: string): Scenario => scenarios[name] ?? {};

/** The permissions the cashier signed in with: refunds are theirs unless the scenario takes them away. */
export const purchasePermissions = (name: string) =>
  name === "reprint-nopermission"
    ? []
    : scenarioOf(name).noRefund
      ? ["sale.create"]
      : ["sale.create", "refund.request"];
