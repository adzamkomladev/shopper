import type { DraftView, SaleRegister, SaleSnapshot } from "../src/sale/types";
import { money } from "@shopper/money";
import { emptyView, items, basket, id, matches, priceLabelled, today } from "./fixtures";
import { makeReceipt } from "./receipts";
import { customerScenarios } from "./sale/customers";
import { withCashTender, withTender } from "./sale/tenders";

const register = (change: Partial<SaleRegister> = {}): SaleRegister => ({
  clearCartAfterSale: true,
  printAutomatically: true,
  printer: { state: "ready", lastJob: null },
  ...change,
});
const heldView = basket(items.slice(0, 1));
const held = {
  ...heldView,
  draft: heldView.draft
    ? { ...heldView.draft, id: id("7"), status: "held" as const, name: "Milo customer" }
    : null,
};
/** The held sale after its customer paid part of it: only a manager can void it now. */
const heldPaid = (kind: "cash" | "card"): DraftView => ({
  ...held,
  draft: held.draft && {
    ...held.draft,
    tenders: [
      {
        id: id("11"),
        orgId: id("2"),
        draftId: held.draft.id,
        position: 0,
        kind,
        amount: money(545_000),
        reference: null,
        approvalCode: kind === "card" ? "A1B2C3" : null,
        last4: null,
        phone: null,
        network: null,
        status: "applied",
        createdAt: today,
      },
    ],
  },
});
const base: SaleSnapshot = {
  host: "connected",
  loading: false,
  view: basket(items.slice(0, 4)),
  held: [held],
  receipt: null,
  paymentNotice: null,
  failure: null,
  busy: false,
  search: { query: "", status: "idle", matches: [] },
  feedback: null,
  operationError: null,
  permissions: ["sale.void", "payment.momo", "customer.read", "customer.write"],
  sync: { offline: false, pendingCount: 0, canSync: true, syncing: false },
  register: register(),
  receiptPrint: null,
  approvers: { permission: null, status: "idle", approvers: [], stale: false },
};
// Cash was taken, so voiding needs a manager; the void-* scenarios differ in how the approvers answer.
const voidCash: SaleSnapshot = { ...base, view: withCashTender(money(500_000)) };
const roundedView = (gross: ReturnType<typeof money>) => {
  const view = basket([
    { id: "round", sku: "ROUND", name: "Rounding test item", unitPrice: gross },
  ]);
  return { ...view, cashRounding: "10p" as const };
};

export const scenarios: Record<string, SaleSnapshot> = {
  lines: base,
  ...customerScenarios(base),
  many: { ...base, view: basket(items) },
  empty: { ...base, view: emptyView },
  loading: { ...base, loading: true, view: null },
  busy: { ...base, busy: true },
  levy: { ...base, view: basket([{ ...items[0]!, covidBps: 100 }, items[1]!]) },
  results: { ...base, search: { query: "milo", status: "ready", matches } },
  searching: { ...base, search: { query: "milo", status: "loading", matches: [] } },
  nomatch: { ...base, search: { query: "milo", status: "ready", matches: [] } },
  searchfail: { ...base, search: { query: "milo", status: "failed", matches: [] } },
  unknown: { ...base, feedback: { kind: "unknown", code: "5012345600001" } },
  rejected: {
    ...base,
    feedback: { kind: "rejected", message: "A scanned code carries its own quantity." },
  },
  unavailable: {
    ...base,
    view: basket(items.slice(0, 2), [
      { id: "x1", error: "PRICE_MISSING" },
      { id: "x2", error: "PRODUCT_UNKNOWN" },
    ]),
  },
  session: { ...base, failure: "session" },
  permission: { ...base, failure: "permission" },
  storage: { ...base, failure: "storage", view: null },
  offline: { ...base, sync: { offline: true, pendingCount: 3, canSync: false, syncing: false } },
  disconnected: { ...base, host: "disconnected", sync: { ...base.sync, canSync: false } },
  connecting: {
    ...base,
    host: "connecting",
    view: null,
    loading: true,
    sync: { ...base.sync, canSync: false },
  },
  syncing: { ...base, sync: { offline: false, pendingCount: 2, canSync: false, syncing: true } },
  momo: base,
  "momo-otp": { ...base, view: withTender("otp") },
  "momo-otp-error": {
    ...base,
    view: withTender("otp"),
    paymentNotice: {
      reference: id("88"),
      amount: money(1_265_000),
      phone: "******4567",
      network: "mtn",
      status: "otp",
      failureReason: "Incorrect one-time code.",
    },
  },
  "momo-stale-otp-error": {
    ...base,
    view: withTender("pending"),
    paymentNotice: {
      reference: id("88"),
      amount: money(1_265_000),
      phone: "******4567",
      network: "mtn",
      status: "otp",
      failureReason: "Incorrect one-time code.",
    },
  },
  "momo-pending": { ...base, view: withTender("pending") },
  "momo-confirmed": {
    ...base,
    view: withTender("confirmed"),
    paymentNotice: {
      reference: id("88"),
      amount: money(1_265_000),
      phone: "******4567",
      network: "mtn",
      status: "confirmed",
      failureReason: null,
    },
  },
  "momo-orphan-confirmed": {
    ...base,
    paymentNotice: {
      reference: id("89"),
      amount: money(1_265_000),
      phone: "******4567",
      network: "mtn",
      status: "confirmed",
      failureReason: null,
    },
  },
  "momo-failed": { ...base, view: withTender("failed") },
  "momo-expired": { ...base, view: withTender("expired") },
  "round-up": { ...base, view: roundedView(money(12_500)) },
  "round-down": { ...base, view: roundedView(money(12_400)) },
  insufficient: { ...base, view: withCashTender(money(500_000)) },
  "no-void-permission": { ...base, permissions: [] },
  "held-void-cash": { ...base, held: [heldPaid("cash")] },
  "held-void-card": { ...base, held: [heldPaid("card")] },
  "void-cash": voidCash,
  "void-locked": voidCash,
  "void-forbidden": voidCash,
  "void-no-approvers": voidCash,
  "void-stale-approvers": voidCash,
  "void-approvers-loading": voidCash,
  "void-approvers-failed": voidCash,
  "price-manager": { ...base, permissions: [...base.permissions, "sale.price_override"] },
  "price-label": { ...base, view: basket([...items.slice(0, 2), priceLabelled]) },
  override: {
    ...base,
    view: basket(
      items
        .slice(0, 4)
        .map((spec) =>
          spec.id === "l4"
            ? { ...spec, unitPrice: money(50_000), listPrice: spec.unitPrice }
            : spec,
        ),
    ),
  },
  "no-momo-permission": { ...base, permissions: ["sale.void"] },
  complete: { ...base, view: null, receipt: makeReceipt() },
  // The printer scenarios start with a basket; completing the sale plays out the print.
  "lines-keep": { ...base, register: register({ clearCartAfterSale: false }) },
  "lines-offline": {
    ...base,
    register: register({ printer: { state: "offline", lastJob: null } }),
  },
  "lines-manual": { ...base, register: register({ printAutomatically: false }) },
  "lines-noprinter": {
    ...base,
    register: register({ printer: { state: "unconfigured", lastJob: null } }),
  },
  "lines-slowprint": base,
  // The printer never reports back, so the print stays unknown.
  "lines-stuck": base,
};
