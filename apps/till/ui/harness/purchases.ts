import type {
  PurchaseDetails,
  PurchaseFilters,
  PurchaseSummary,
  PurchasesSnapshot,
} from "../src/sale/types";
import { makeReceipt, makeSaleSnapshot } from "./receipts";
import { id, today } from "./fixtures";

const filters: PurchaseFilters = { status: "all", query: "", kind: "all", page: 1, pageSize: 20 };

export const purchaseSummary: PurchaseSummary = {
  id: id("10482"),
  status: "completed",
  receiptNumber: "10482",
  occurredAt: today,
  total: 1_265_000,
  kinds: ["cash"],
};

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

export const purchaseDetailsFor = (scenario: string): PurchaseDetails => ({
  ...purchaseSummary,
  payment: null,
  sale: makeSaleSnapshot(),
  receipt: makeReceipt(),
  draft: null,
  delivery: deliveries[scenario] ?? delivery,
});

const emptyPurchases = (
  status: PurchasesSnapshot["status"],
  error: string | null = null,
): PurchasesSnapshot => ({
  status,
  filters,
  purchases: [],
  total: 0,
  page: 1,
  pageSize: 20,
  selected: null,
  error,
  reprint: null,
});

const purchaseScenarios: Record<string, PurchasesSnapshot> = {
  default: {
    status: "ready",
    filters,
    purchases: [purchaseSummary],
    total: 1,
    page: 1,
    pageSize: 20,
    selected: null,
    error: null,
    reprint: null,
  },
  "purchases-loading": emptyPurchases("loading"),
  "purchases-empty": emptyPurchases("empty"),
  "purchases-offline": emptyPurchases("offline"),
  "purchases-error": emptyPurchases("error", "The host could not read its purchase records."),
};

export const initialPurchases = (scenario: string): PurchasesSnapshot =>
  purchaseScenarios[scenario] ?? purchaseScenarios.default!;
