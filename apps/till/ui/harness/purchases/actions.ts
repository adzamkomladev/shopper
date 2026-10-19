// Test-only purchase actions for the till UI harness: they answer the way the register host would.
import type { Dispatch, SetStateAction } from "react";
import { printFailure } from "../../src/purchases/delivery";
import { idleLookup } from "../../src/purchases/returns";
import { previewRefund } from "../../src/purchases/preview";
import type {
  PurchaseActions,
  PurchaseDetails,
  PurchasesSnapshot,
  ReprintFeedback,
} from "../../src/sale/types";
import { approversFor, judge } from "../approvals";
import { matching, purchaseDetailsFor, purchasesOf, rows } from "./data";
import { scenarioOf } from "./scenarios";

type Recorder = (type: string) => (...args: unknown[]) => unknown;
type SetPurchases = Dispatch<SetStateAction<PurchasesSnapshot>>;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const refused = "connection refused (192.168.1.50:9100)";
const unreachable = "The server could not be reached. Try again.";

export function purchaseActions(
  name: string,
  record: Recorder,
  setPurchases: SetPurchases,
  printerFails: boolean,
): PurchaseActions {
  const scenario = scenarioOf(name);
  const change = (next: Partial<PurchasesSnapshot>) =>
    setPurchases((current) => ({ ...current, ...next }));
  const actions: PurchaseActions = {
    list: (filters) => {
      record("listPurchases")(filters);
      setPurchases((current) => {
        // The loading, empty, offline and error scenarios hold their state.
        if (["loading", "empty", "offline", "error"].includes(current.status))
          return { ...current, filters, selected: null, returning: null };
        const found = matching(filters.query, filters.kind);
        const shown = found.filter(
          (purchase) => filters.status === "all" || purchase.status === filters.status,
        );
        return {
          ...purchasesOf(shown),
          counts: purchasesOf(found).counts,
          filters,
          approvers: current.approvers,
        };
      });
    },
    read: (saleId) => {
      record("readPurchase")(saleId);
      const summary = rows.find((purchase) => purchase.id === saleId);
      change({
        selected: summary ? purchaseDetailsFor(name, summary) : purchaseDetailsFor(name),
        reprint: null,
      });
    },
    clear: () => {
      record("clearPurchase")();
      change({ selected: null, returning: null, reprint: null });
    },
    lookup: async (receipt) => {
      record("lookupPurchase")(receipt);
      change({ lookup: { status: "loading", receipt, message: null } });
      await sleep(120);
      const local = rows.find((purchase) => purchase.receiptNumber === receipt);
      if (local) return change({ selected: purchaseDetailsFor(name, local), lookup: idleLookup });
      if (scenario.lookup === "found")
        return change({
          selected: purchaseDetailsFor("return-server", {
            ...rows[1]!,
            id: "10000000-0000-7000-8000-000000020555",
            receiptNumber: receipt,
          }),
          lookup: idleLookup,
        });
      const failed = scenario.lookup === "failed";
      change({
        lookup: {
          status: failed ? "failed" : scenario.lookup === "offline" ? "offline" : "missing",
          receipt,
          message: failed ? unreachable : null,
        },
      });
    },
    startReturn: async (purchase) => {
      record("startReturn")(purchase.id);
      change({ returning: { status: "loading" } });
      await sleep(150);
      if (scenario.preview === "loading") return;
      if (scenario.preview === "offline")
        return change({
          returning: {
            status: "failed",
            code: "OFFLINE_UNAVAILABLE",
            message: "Connect to the internet to refund a sale from another register",
          },
        });
      const eligibility = purchase.eligibility;
      if (!eligibility) return;
      const gone = scenario.preview === "gone";
      change({
        returning: {
          status: "ready",
          eligibility: gone
            ? {
                ...eligibility,
                refundable: false,
                lines: eligibility.lines.map((line) => ({ ...line, status: "returned" as const })),
              }
            : eligibility,
        },
      });
      if (eligibility.approvalRequired) actions.loadApprovers("refund.approve");
    },
    endReturn: () => {
      record("endReturn")();
      change({ returning: null });
    },
    refund: async (purchase, input) => {
      record("refund")(input);
      await sleep(120);
      if (scenario.refundError) return { ok: false, ...scenario.refundError };
      const outcome = judge(name, input.approval);
      if (!outcome.ok) return outcome;
      const quantities = Object.fromEntries(
        input.lines.map((line) => [line.lineId, line.quantityThousandths]),
      );
      const total = previewRefund(purchase, quantities)?.gross ?? 0;
      change({
        selected: refunded(purchase, quantities, total, input.reason, input.tender),
        returning: null,
      });
      return { ok: true, total };
    },
    loadApprovers: async (permission) => {
      record("loadApprovers")(permission);
      change({ approvers: approversFor(name, permission) });
    },
    reprint: async (saleId) => {
      record("reprint")(saleId);
      const set = (reprint: ReprintFeedback) => change({ reprint });
      set({ status: "running", message: null });
      await sleep(name === "reprint-slow" ? 1500 : 300);
      if (printerFails) {
        const failed: ReprintFeedback = { status: "failed", message: printFailure(refused) };
        set(failed);
        return failed;
      }
      const done: ReprintFeedback = { status: "done", message: null };
      setPurchases((current) => ({
        ...current,
        reprint: done,
        selected: current.selected?.delivery
          ? {
              ...current.selected,
              delivery: {
                ...current.selected.delivery,
                printedAt: current.selected.delivery.printedAt ?? new Date().toISOString(),
                printError: null,
                reprints: current.selected.delivery.reprints + 1,
              },
            }
          : current.selected,
      }));
      return done;
    },
  };
  return actions;
}

/** The sale as the host reads it again after a refund: lines used up, the refund on the record. */
function refunded(
  purchase: PurchaseDetails,
  quantities: Record<string, number>,
  total: number,
  reason: string,
  tender: PurchaseDetails["refunds"][number]["tender"],
): PurchaseDetails {
  const eligibility = purchase.eligibility;
  return {
    ...purchase,
    refunded: "partial",
    refunds: [
      ...purchase.refunds,
      {
        id: "10000000-0000-7000-8000-000000000999",
        occurredAt: new Date().toISOString(),
        reason,
        tender,
        total,
        approverId: null,
        lines: [],
        // A refund on this till waits to upload; one on another register's sale was accepted by the server.
        accepted: purchase.origin === "server",
        blockedCode: null,
        blockedReason: null,
      },
    ],
    eligibility: eligibility && withRefund(eligibility, quantities),
  };
}

function withRefund(
  eligibility: NonNullable<PurchaseDetails["eligibility"]>,
  quantities: Record<string, number>,
) {
  const lines = eligibility.lines.map((line) => {
    const back = line.refundedThousandths + (quantities[line.lineId] ?? 0);
    return {
      ...line,
      refundedThousandths: back,
      remainingThousandths: line.soldThousandths - back,
      status:
        line.status === "eligible" && back === line.soldThousandths
          ? ("returned" as const)
          : line.status,
    };
  });
  return { ...eligibility, lines, refundable: lines.some((line) => line.status === "eligible") };
}
