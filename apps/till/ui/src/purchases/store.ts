import { useSyncExternalStore } from "react";
import { connectionSnapshot, request } from "../connection/store";
import { sendReprint } from "./reprint";
import { currentDraftRevision } from "../sale/store";
import type { PurchaseActions, PurchaseFilters, PurchasesSnapshot } from "../sale/types";

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
let state: PurchasesSnapshot = {
  status: "idle",
  filters: initialFilters,
  purchases: [],
  total: 0,
  page: 1,
  pageSize: 20,
  selected: null,
  error: null,
  reprint: null,
};

export function usePurchasesSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export const purchaseActions: PurchaseActions = {
  list: async (filters) => {
    const requestId = ++listRequest;
    selectionRequest += 1;
    if (connectionSnapshot().host !== "connected")
      return update({
        status: "offline",
        selected: null,
        error: "Purchases are unavailable while the register host is offline.",
      });
    update({ status: "loading", filters, selected: null, error: null });
    const reply = await request({
      type: "sales.list",
      expectedRevision: currentDraftRevision(),
      ...filters,
    });
    if (requestId !== listRequest) return;
    if (reply?.type === "result" && reply.kind === "purchases")
      update({
        status: reply.purchases.length === 0 ? "empty" : "ready",
        purchases: reply.purchases,
        total: reply.total,
        page: reply.page,
        pageSize: reply.pageSize,
        error: null,
      });
    else update({ status: "error", error: messageOf(reply) });
  },
  read: async (saleId) => {
    const requestId = ++selectionRequest;
    update({ selected: null, error: null, reprint: null });
    const reply = await readReply(saleId);
    if (requestId !== selectionRequest) return;
    if (reply?.type === "result" && reply.kind === "purchase")
      update({ selected: reply.purchase, error: null });
    else update({ error: messageOf(reply) });
  },
  clear: () => {
    selectionRequest += 1;
    update({ selected: null, error: null, reprint: null });
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
};

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
