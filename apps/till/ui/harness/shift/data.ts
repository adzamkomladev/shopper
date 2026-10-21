// Test-only shift fixtures for the till UI harness: the register's shift, its X report and the Z a close would print.
import type { CashCounts, XReport, ZReport } from "@shopper/core/schemas";
import { countedCash } from "@shopper/core/schemas";
import type { ShiftSnapshot, ShiftStatus, Variance } from "../../src/shift/types";
import { id } from "../fixtures";

export const threshold = 50_000;
const opener = id("30");
export const user = { userId: opener, name: "Ama Mensah" };
export const shiftId = id("90");
const openedAt = "2026-10-15T08:00:00.000Z";

export const openShift: NonNullable<ShiftStatus["current"]> = {
  id: shiftId,
  status: "open",
  openedAt,
  openedBy: opener,
  float: 2_000_000,
};

const lastClosed = (upload: "pending" | "accepted" | "rejected"): ShiftStatus["last"] => ({
  id: id("80"),
  closedAt: "2026-10-14T18:30:00.000Z",
  upload,
  blockedReason: upload === "rejected" ? "Declared cash does not match its counts" : null,
});

/** GH₵ 240.00 expected in the drawer: 200 float + 150 cash sales − 10 refunds − 100 dropped. */
export const xReport: XReport = {
  kind: "x",
  shiftId,
  storeId: id("3"),
  branchId: id("4"),
  deviceId: id("5"),
  registerName: "Till 1",
  openedAt,
  openedBy: opener,
  at: "2026-10-15T14:20:00.000Z",
  sales: { count: 14, gross: 1_920_000, tax: 320_000 },
  refunds: { count: 1, total: 100_000 },
  tenders: [
    { tender: "cash", sales: 1_500_000, refunds: 100_000, expected: 2_400_000 },
    { tender: "card", sales: 300_000, refunds: 0, expected: 300_000 },
    { tender: "momo", sales: 120_000, refunds: 0, expected: 120_000 },
  ],
  cash: {
    float: 2_000_000,
    sales: 1_500_000,
    refunds: 100_000,
    drops: 1_000_000,
    expected: 2_400_000,
  },
  movements: [
    {
      kind: "no_sale",
      amount: 0,
      reason: "Change for a customer",
      actorId: opener,
      at: "2026-10-15T10:05:00.000Z",
    },
    {
      kind: "drop",
      amount: 1_000_000,
      reason: "Bank run",
      actorId: id("31"),
      at: "2026-10-15T11:40:00.000Z",
    },
  ],
  cashiers: [
    { userId: opener, name: "Ama Mensah" },
    { userId: id("31"), name: "Kofi Boateng" },
  ],
};

/** What the register would answer to a count: variance per tender against the fixture's expected figures. */
export function judge(counts: CashCounts, card: number, momo: number) {
  const cash = Number(countedCash(counts));
  const variances: Variance[] = [
    { tender: "cash", expected: 2_400_000, declared: cash, variance: cash - 2_400_000 },
    { tender: "card", expected: 300_000, declared: card, variance: card - 300_000 },
    { tender: "momo", expected: 120_000, declared: momo, variance: momo - 120_000 },
  ];
  const approvalRequired = variances.some((row) => Math.abs(row.variance) > threshold);
  return { cash, variances, approvalRequired };
}

export function zReport(
  declared: ZReport["declared"],
  variances: Variance[],
  approverId: string | null,
): ZReport {
  return {
    ...xReport,
    kind: "z",
    appVersion: "0.1.0",
    declared,
    variances,
    threshold,
    approverId,
    closedAt: "2026-10-15T17:05:00.000Z",
    closedBy: opener,
    anchor: { seq: 42, hash: "0123456789abcdef".repeat(4) },
  };
}

const lasts: Record<string, ShiftStatus["last"]> = {
  "shift-last-pending": lastClosed("pending"),
  "shift-last-accepted": lastClosed("accepted"),
  "shift-last-rejected": lastClosed("rejected"),
  "shift-open": lastClosed("accepted"),
  "shift-none": null,
};

/** The register's shift for a scenario. Scenarios that are not about shifts have one open, so selling works. */
export function initialShift(name: string, permissions: string[]): ShiftSnapshot {
  const closed =
    ["shift-none", "shift-open-refused"].includes(name) || name.startsWith("shift-last-");
  return {
    host: name === "shift-disconnected" ? "disconnected" : "connected",
    phase: closed ? "closed" : name === "shift-counting" ? "counting" : "open",
    current: closed
      ? null
      : name === "shift-counting"
        ? { ...openShift, status: "declared" }
        : openShift,
    last:
      name in lasts
        ? lasts[name]!
        : name.startsWith("shift-") && name !== "shift-open-first"
          ? lastClosed("accepted")
          : null,
    permissions,
    user,
    printer: name === "shift-print-offline" ? "offline" : "ready",
    report: { status: "idle" },
    judgement: null,
    approvalRequired: false,
    closed: null,
    approvers: { permission: null, status: "idle", approvers: [], stale: false },
  };
}
