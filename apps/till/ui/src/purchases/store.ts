import { useSyncExternalStore } from "react";
import { connectionSnapshot, request } from "../connection/store";
import { sendReprint } from "./reprint";
import { currentDraftRevision } from "../sale/store";
import { loadingApprovers, readApprovers } from "../sale/approvers";
import type { PurchaseActions, PurchaseFilters, PurchasesSnapshot } from "../sale/types";
import { createReturns, idleLookup } from "./returns";

const initialFilters: PurchaseFilters = {
  status: "all",
  query: "",
  kind: "all",
  page: 1,
  pageSize: 20,
};
const listeners = new Set<() => void>();
let listRequest = 0;
let selectionRequest = 0;
/** A refund changed the records, so the list is read again the next time the cashier is back on it. */
let outOfDate = false;
let state: PurchasesSnapshot = {
  status: "idle",
  filters: initialFilters,
  purchases: [],
  counts: { all: 0, completed: 0, returned: 0, voided: 0, pending: 0 },
  total: 0,
  page: 1,
  pageSize: 20,
  selected: null,
  error: null,
  reprint: null,
  lookup: idleLookup,
  returning: null,
  approvers: { permission: null, status: "idle", approvers: [], stale: false },
};

export function usePurchasesSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

const returns = createReturns({
  update,
  select: () => ++selectionRequest,
  isCurrent: (selection) => selection === selectionRequest,
  markStale: () => void (outOfDate = true),
});

export const purchaseActions: PurchaseActions = {
  list: (filters) => void load(filters, false),
  read: async (saleId) => {
    const requestId = ++selectionRequest;
    returns.stop();
    update({ selected: null, returning: null, error: null, reprint: null, lookup: idleLookup });
    const reply = await readReply(saleId);
    if (requestId !== selectionRequest) return;
    if (reply?.type === "result" && reply.kind === "purchase")
      update({ selected: reply.purchase, error: null });
    else update({ error: messageOf(reply) });
  },
  clear: () => {
    selectionRequest += 1;
    returns.stop();
    update({ selected: null, returning: null, error: null, reprint: null });
    if (outOfDate) void load(state.filters, true);
  },
  reprint: async (saleId) => {
    if (state.reprint?.status === "running") return state.reprint;
    update({ reprint: { status: "running", message: null } });
    const feedback = await sendReprint(saleId);
    update({ reprint: feedback });
    // The receipt stays open; only its delivery details are read again.
    const requestId = selectionRequest;
    const fresh = await readReply(saleId);
    if (requestId === selectionRequest && fresh?.type === "result" && fresh.kind === "purchase")
      update({ selected: fresh.purchase });
    return feedback;
  },
  lookup: returns.lookup,
  startReturn: async (purchase) => {
    await returns.startReturn(purchase);
    const next = state.returning;
    if (next?.status === "ready" && next.eligibility.approvalRequired)
      await purchaseActions.loadApprovers("refund.approve");
  },
  endReturn: returns.endReturn,
  refund: returns.refund,
  loadApprovers: async (permission) => {
    update({ approvers: loadingApprovers(permission) });
    update({ approvers: await readApprovers(permission) });
  },
};

/** `quiet` re-reads the rows behind an open screen without a skeleton or closing anything. */
async function load(filters: PurchaseFilters, quiet: boolean) {
  const requestId = ++listRequest;
  if (!quiet) selectionRequest += 1;
  if (connectionSnapshot().host !== "connected")
    return quiet
      ? undefined
      : update({
          status: "offline",
          selected: null,
          returning: null,
          error: "Purchases are unavailable while the register host is offline.",
        });
  if (!quiet) {
    returns.stop();
    update({
      status: "loading",
      filters,
      selected: null,
      returning: null,
      error: null,
      lookup: idleLookup,
    });
  }
  const reply = await request({
    type: "sales.list",
    expectedRevision: currentDraftRevision(),
    ...filters,
  });
  if (requestId !== listRequest) return;
  if (reply?.type === "result" && reply.kind === "purchases") {
    outOfDate = false;
    update({
      status: reply.purchases.length === 0 ? "empty" : "ready",
      purchases: reply.purchases,
      counts: reply.counts,
      total: reply.total,
      page: reply.page,
      pageSize: reply.pageSize,
      error: null,
    });
  } else if (!quiet) update({ status: "error", error: messageOf(reply) });
}

const readReply = (saleId: string) =>
  request({ type: "sales.read", expectedRevision: currentDraftRevision(), saleId });

function messageOf(reply: Awaited<ReturnType<typeof request>>) {
  return reply?.type === "error"
    ? reply.message
    : "The register connection ended. Reconnect and try again.";
}

function update(change: Partial<PurchasesSnapshot>) {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
