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

export const purchaseDetails: PurchaseDetails = {
  ...purchaseSummary,
  payment: null,
  sale: makeSaleSnapshot(),
  receipt: makeReceipt(),
  draft: null,
};

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
  },
  "purchases-loading": emptyPurchases("loading"),
  "purchases-empty": emptyPurchases("empty"),
  "purchases-offline": emptyPurchases("offline"),
  "purchases-error": emptyPurchases("error", "The host could not read its purchase records."),
};

export const initialPurchases = (scenario: string): PurchasesSnapshot =>
  purchaseScenarios[scenario] ?? purchaseScenarios.default!;
