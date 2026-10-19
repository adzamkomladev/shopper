// Test-only shift actions for the till UI harness: they record the call, then change the snapshot as the host would.
import { useState } from "react";
import { countedCash, type ZReport } from "@shopper/core/schemas";
import type { ReprintFeedback, SaleOutcome } from "../../src/sale/types";
import type { ShiftActions, ShiftSnapshot, Variance } from "../../src/shift/types";
import { lost } from "../../src/shift/replies";
import { approversFor, judge as judgeApproval, managers } from "../approvals";
import { id } from "../fixtures";
import { initialShift, judge, openShift, threshold, xReport, zReport } from "./data";

type Recorder = (type: string) => (...args: unknown[]) => unknown;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const refused = (code: string, message: string): SaleOutcome => ({ ok: false, code, message });
const printerDown = "The printer is offline. Check its power and network, then print again.";

export function useShiftHarness(
  name: string,
  permissions: string[],
  record: Recorder,
): [ShiftSnapshot, ShiftActions] {
  const [shift, setShift] = useState(() => initialShift(name, permissions));
  const [reads, setReads] = useState(0);
  const change = (next: Partial<ShiftSnapshot>) => setShift((now) => ({ ...now, ...next }));
  const printFeedback = (): ReprintFeedback =>
    name === "shift-print-offline"
      ? { status: "failed", message: printerDown }
      : { status: "done", message: null };
  const showApprovers = () =>
    change({ approvers: approversFor(name.replace("shift-close-", "void-"), "shift.approve") });

  function closeWith(
    declared: ZReport["declared"],
    variances: Variance[],
    approverId: string | null,
  ) {
    const report = zReport(declared, variances, approverId);
    const approverName = managers.find((manager) => manager.userId === approverId)?.name ?? null;
    return {
      phase: "closed" as const,
      current: null,
      last: {
        id: id("81"),
        closedAt: report.closedAt,
        upload: "pending" as const,
        blockedReason: null,
      },
      closed: { report, printed: name !== "shift-close-printer-offline", approverName },
    };
  }

  const actions: ShiftActions = {
    open: async (input) => {
      record("shiftOpen")(input);
      if (name === "shift-open-refused")
        return refused("SHIFT_OPEN", "This register already has an open shift");
      const float = "float" in input ? input.float : Number(countedCash(input.counts));
      change({
        phase: "open",
        current: { ...openShift, float },
        closed: null,
        report: { status: "idle" },
      });
      return { ok: true };
    },
    drop: async (amount, reason) => {
      record("shiftDrop")(...(reason ? [amount, reason] : [amount]));
      return name === "shift-counted-drop"
        ? refused("SHIFT_COUNTED", "The drawer is counted. Close the shift")
        : { ok: true };
    },
    noSale: async (reason) => {
      record("shiftNoSale")(reason);
      return { ok: true };
    },
    loadReport: async (quiet) => {
      if (!permissions.includes("report.read") || shift.phase !== "open") return;
      record("loadReport")();
      if (!quiet || shift.report.status !== "ready") change({ report: { status: "loading" } });
      if (name === "shift-report-loading") return;
      await sleep(150);
      if (name === "shift-report-error" && reads === 0) {
        setReads(1);
        return change({
          report: { status: "failed", message: "The register is busy. Try again in a moment." },
        });
      }
      change({ report: { status: "ready", report: xReport } });
    },
    printX: async () => {
      record("printX")();
      return printFeedback();
    },
    reprintZ: async () => {
      record("reprintZ")();
      return printFeedback();
    },
    declare: async (counts, card, momo) => {
      record("shiftDeclare")(counts, card, momo);
      if (name === "shift-close-busy")
        return refused("SHIFT_BUSY", "Finish or void the basket with a payment first");
      if (name === "shift-close-lost") return refused("CONNECTION_LOST", lost);
      const { cash, variances, approvalRequired } = judge(counts, card, momo);
      const declared = { counts, cash, card, momo };
      if (approvalRequired) {
        change({
          phase: "counting",
          current: { ...openShift, status: "declared" },
          judgement: { variances, threshold },
          approvalRequired: true,
        });
        showApprovers();
      } else
        change({ ...closeWith(declared, variances, null), judgement: { variances, threshold } });
      return { ok: true };
    },
    close: async (approval) => {
      record("shiftClose")(...(approval ? [approval] : []));
      if (!approval && (shift.approvalRequired || name === "shift-counting")) {
        change({ approvalRequired: true });
        showApprovers();
        return refused("APPROVAL_REQUIRED", "A manager must approve this close");
      }
      const outcome = judgeApproval(name.replace("shift-close-", "void-"), approval);
      if (!outcome.ok) return outcome;
      const variances = shift.judgement?.variances ?? [];
      const declared = { counts: {}, cash: 0, card: 0, momo: 0 };
      change(closeWith(declared, variances, approval?.approverId ?? null));
      return { ok: true };
    },
    loadApprovers: () => {
      record("loadApprovers")();
      showApprovers();
    },
    dismissClosed: () => {
      record("dismissClosed")();
      change({ closed: null, judgement: null, approvalRequired: false });
    },
    reconnect: record("reconnect"),
  };
  return [shift, actions];
}
