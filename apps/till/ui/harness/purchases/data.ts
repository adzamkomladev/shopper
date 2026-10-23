// Test-only purchases fixtures for the till UI harness: the list, the sale behind it and what each scenario changes.
import type {
  EligibilityView,
  PurchaseDetails,
  PurchaseFilters,
  PurchaseSummary,
  PurchasesSnapshot,
  RefundSummary,
} from "../../src/sale/types";
import { idleLookup } from "../../src/purchases/returns";
import { makeReceipt, makeSaleSnapshot } from "../receipts";
import { id, today } from "../fixtures";
import { scenarioOf } from "./scenarios";
import type { Scenario } from "./types";

export const filters: PurchaseFilters = {
  status: "all",
  query: "",
  kind: "all",
  page: 1,
  pageSize: 20,
};

const row = (number: string, change: Partial<PurchaseSummary>): PurchaseSummary => ({
  id: id(number),
  status: "completed",
  receiptNumber: number,
  occurredAt: today,
  total: 1_265_000,
  kinds: ["cash"],
  refundOf: null,
  refunded: "none",
  customer: null,
  ...change,
});

/** Newest first, like the host's list. */
export const rows: PurchaseSummary[] = [
  row("10490", {
    status: "returned",
    receiptNumber: null,
    occurredAt: "2026-10-15T09:45:00.000Z",
    total: -350_000,
    refundOf: "10481",
    customer: undefined,
  }),
  row("10482", { customer: { id: id("501"), name: "Ama Mensah" } }),
  row("10481", {
    occurredAt: "2026-10-15T09:12:00.000Z",
    total: 540_000,
    kinds: ["card"],
    refunded: "partial",
  }),
  row("10480", { status: "voided", occurredAt: "2026-10-15T08:50:00.000Z", total: 120_000 }),
  row("10479", {
    status: "pending",
    occurredAt: "2026-10-15T08:30:00.000Z",
    total: 220_000,
    kinds: ["momo"],
    customer: undefined,
  }),
];
export const purchaseSummary = rows[1]!;

const delivery: NonNullable<PurchaseDetails["delivery"]> = {
  printedAt: today,
  reprints: 0,
  printError: null,
  pdf: "pending",
};
const deliveries: Record<string, PurchaseDetails["delivery"]> = {
  "reprint-twice": { ...delivery, reprints: 2, pdf: "uploaded" },
  "reprint-failedprint": {
    printedAt: null,
    reprints: 0,
    printError: "connection refused (192.168.1.50:9100)",
    pdf: null,
  },
  "reprint-noprinter": { printedAt: null, reprints: 0, printError: null, pdf: null },
};

const RETURN_WINDOW_DAYS = 30;
const sold = makeSaleSnapshot().lines;
function eligibilityOf(scenario: Scenario, occurredAt: string): EligibilityView {
  const lines = sold.map((line, index) => {
    const quantity = line.tax.quantityThousandths;
    const state = scenario.lines?.[index];
    const refundedThousandths = state === "returned" ? quantity : state === "partial" ? 2000 : 0;
    return {
      lineId: line.id,
      productId: line.productId,
      name: line.name,
      soldThousandths: quantity,
      refundedThousandths,
      remainingThousandths: quantity - refundedThousandths,
      status:
        state === "final"
          ? ("final" as const)
          : refundedThousandths === quantity
            ? ("returned" as const)
            : ("eligible" as const),
    };
  });
  return {
    origin: scenario.server ? "server" : "local",
    windowEndsAt: new Date(Date.parse(occurredAt) + RETURN_WINDOW_DAYS * 86_400_000).toISOString(),
    withinWindow: !scenario.windowClosed,
    approvalRequired: !!scenario.approval,
    refundable: lines.some((line) => line.status === "eligible"),
    lines,
  };
}

const refund = (n: string, change: Partial<RefundSummary>): RefundSummary => ({
  id: id(n),
  occurredAt: "2026-10-15T10:00:00.000Z",
  reason: "Damaged",
  tender: { kind: "cash" },
  total: 160_000,
  approverId: null,
  lines: [],
  accepted: true,
  blockedCode: null,
  blockedReason: null,
  ...change,
});
const history: RefundSummary[] = [
  refund("301", {}),
  refund("302", {
    accepted: false,
    tender: { kind: "card", reference: "AUTH-4471" },
    total: 545_000,
    occurredAt: "2026-10-15T10:20:00.000Z",
  }),
  refund("303", {
    accepted: false,
    tender: { kind: "momo", reference: "MP2210" },
    total: 80_000,
    blockedCode: "REFUND_CONFLICT",
    blockedReason: "Another register refunded this line first.",
    occurredAt: "2026-10-15T10:40:00.000Z",
  }),
];

/** The detail of `summary` (the 10482 sale unless the list row says otherwise) under a scenario's rules. */
export function purchaseDetailsFor(
  name: string,
  summary: PurchaseSummary = purchaseSummary,
): PurchaseDetails {
  const scenario = scenarioOf(name);
  const occurredAt = scenario.windowClosed ? "2026-08-15T09:30:00.000Z" : summary.occurredAt;
  const completed = summary.status === "completed";
  return {
    ...summary,
    occurredAt,
    payment: null,
    sale: makeSaleSnapshot(),
    receipt: makeReceipt(),
    draft: null,
    delivery: scenario.server || !completed ? null : (deliveries[name] ?? delivery),
    origin: scenario.server ? "server" : "local",
    refunds: scenario.history ? history : [],
    eligibility: completed ? eligibilityOf(scenario, occurredAt) : null,
  };
}

const emptyPurchases = (
  status: PurchasesSnapshot["status"],
  error: string | null = null,
): PurchasesSnapshot => ({
  ...purchasesOf(rows),
  status,
  purchases: [],
  total: 0,
  error,
});

/** A list of `matching` rows with the tab counts for them. */
export function purchasesOf(matching: PurchaseSummary[]): PurchasesSnapshot {
  const count = (status: PurchaseSummary["status"]) =>
    matching.filter((purchase) => purchase.status === status).length;
  return {
    status: matching.length ? "ready" : "empty",
    filters,
    purchases: matching,
    counts: {
      all: matching.length,
      completed: count("completed"),
      returned: count("returned"),
      voided: count("voided"),
      pending: count("pending"),
    },
    total: matching.length,
    page: 1,
    pageSize: 20,
    selected: null,
    error: null,
    reprint: null,
    lookup: idleLookup,
    returning: null,
    approvers: { permission: null, status: "idle", approvers: [], stale: false },
  };
}

/** The rows a search matches (any day) and the tender kind keeps; the status tab only narrows them after. */
export function matching(query: string, kind: PurchaseFilters["kind"]) {
  const text = query.trim();
  return rows.filter(
    (purchase) =>
      (kind === "all" || purchase.kinds.includes(kind)) &&
      (!text || (purchase.receiptNumber ?? purchase.refundOf ?? "").includes(text)),
  );
}

const purchaseScenarios: Record<string, PurchasesSnapshot> = {
  "purchases-loading": emptyPurchases("loading"),
  "purchases-empty": emptyPurchases("empty"),
  "purchases-offline": emptyPurchases("offline"),
  "purchases-error": emptyPurchases("error", "The host could not read its purchase records."),
};

export const initialPurchases = (scenario: string): PurchasesSnapshot =>
  purchaseScenarios[scenario] ?? purchasesOf(rows);
