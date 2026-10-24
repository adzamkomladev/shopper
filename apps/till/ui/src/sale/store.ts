import { useSyncExternalStore } from "react";
import type { BridgeMessage } from "@shopper/sync/bridge";
import {
  connectRegister,
  connectionSnapshot,
  request,
  retryUpload,
  subscribeBridge,
  subscribeConnection,
} from "../connection/store";
import { canSyncNow } from "../connection/sync";
import type { ConnectionSnapshot } from "../connection/types";
import { sendReprint } from "../purchases/reprint";
import { accountActions } from "./accounts";
import { customerActions } from "./customers";
import { createSaleOperations } from "./operations";
import { asked, mirrorJob, trackPrint, unknownIfPending } from "./print";
import { fresh } from "./initial";
import { registerOf } from "./register";
import { failureOf, isOlder } from "./replies";
import type { AddInput, SaleActions, SaleSnapshot } from "./types";

type State = Omit<SaleSnapshot, "host" | "sync" | "permissions" | "register">;
type Edit =
  | ({ type: "add" } & AddInput)
  | { type: "setQuantity"; lineId: string; quantityThousandths: number }
  | { type: "removeLine"; lineId: string };
const listeners = new Set<() => void>();
let state = fresh;
let composed: { connection: ConnectionSnapshot; state: State; snapshot: SaleSnapshot } | undefined;
const queue: Edit[] = [];
let connectedBefore = false;
let signedBefore = false;
let draining = false;

subscribeConnection(() => {
  const { host, status } = connectionSnapshot();
  const connected = host === "connected";
  // A host that reports no `user` is not asked to sign anyone in, so its answer changes nothing here.
  const signedIn = status?.user === undefined ? signedBefore : status.user !== null;
  // Signing out drops the basket on screen; signing in loads the next staff member's own.
  if (!signedIn && signedBefore) state = fresh;
  if (connected && (!connectedBefore || (signedIn && !signedBefore))) void load();
  connectedBefore = connected;
  signedBefore = signedIn;
  const register = registerOf(connectionSnapshot().status);
  if (state.receiptPrint)
    state = { ...state, receiptPrint: mirrorJob(state.receiptPrint, register) };
  notify();
});
subscribeBridge((message) => {
  if (message.type === "draft" && !state.receipt) update({ view: message.view });
  if (message.type === "payment") update({ paymentNotice: message.payment });
});

export function useSaleSnapshot() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

const operations = createSaleOperations({ canEdit, canStartNewSale, revision, update, report });

export const saleActions: SaleActions = {
  search,
  add: (input) => enqueue({ type: "add", ...input }),
  setQuantity: (lineId, quantityThousandths) =>
    enqueue({ type: "setQuantity", lineId, quantityThousandths }),
  removeLine: (lineId) => enqueue({ type: "removeLine", lineId }),
  addTender: (input) =>
    void operations.runDraft((expectedRevision) => ({
      ...input,
      type: "tender.add",
      expectedRevision,
    })),
  charge: (input) => void operations.charge(input),
  complete: () => void operations.complete(),
  removeTender: (tenderId) =>
    void operations.runDraft((expectedRevision) => ({
      type: "tender.remove",
      expectedRevision,
      tenderId,
    })),
  startMomo: (input) =>
    void operations.runDraft((expectedRevision) => ({
      type: "payment.momo.start",
      expectedRevision,
      ...input,
    })),
  submitMomoOtp: (input) =>
    void operations.runDraft((expectedRevision) => ({
      type: "payment.momo.otp",
      expectedRevision,
      ...input,
    })),
  hold: (name) => void operations.holdSale(name),
  listHeld: () => void operations.listHeld(),
  resume: (draftId, expectedRevision) =>
    void operations.runDraft(() => ({ type: "sale.resume", draftId, expectedRevision })),
  voidSale: operations.voidSale,
  priceLine: operations.priceLine,
  ...customerActions(operations.runDraft),
  ...accountActions(operations.runDraft),
  loadApprovers: (permission) => void operations.loadApprovers(permission),
  newSale: () => void operations.newSale(),
  newSaleWith: (input) => void operations.newSale().then(() => enqueue({ type: "add", ...input })),
  print: async (saleId) => {
    const result = await sendReprint(saleId);
    if (state.receipt?.saleId === saleId) update({ receiptPrint: asked(saleId, result) });
    return result;
  },
  dismissFeedback: () => update({ feedback: null }),
  syncNow: retryUpload,
  reconnect: () => (connectionSnapshot().host === "connected" ? void load() : connectRegister()),
};

async function load() {
  update({ loading: true });
  const reply = await request({ type: "readDraft" });
  if (reply?.type === "result" && reply.kind === "draft")
    return update({ loading: false, view: reply.view, failure: null });
  if (reply?.type === "error") update({ failure: failureOf(reply), operationError: reply.message });
  update({ loading: false });
}

function canEdit() {
  return (
    connectionSnapshot().host === "connected" &&
    state.failure === null &&
    state.receipt === null &&
    !state.busy
  );
}

function canEnqueue() {
  return (
    connectionSnapshot().host === "connected" &&
    state.failure === null &&
    state.receipt === null &&
    (!state.busy || draining)
  );
}

function canStartNewSale() {
  return connectionSnapshot().host === "connected" && state.failure === null && !state.busy;
}

function revision() {
  return state.view?.draft?.revision ?? 0;
}

export function currentDraftRevision() {
  return revision();
}

function enqueue(edit: Edit) {
  if (!canEnqueue()) return;
  if ("code" in edit && edit.code.length > 64)
    return update({ feedback: { kind: "unknown", code: edit.code } });
  queue.push(edit);
  if (!state.busy) void drain();
}

async function drain() {
  draining = true;
  update({ busy: true });
  try {
    for (let edit = queue.shift(); edit; edit = queue.shift()) {
      const reply = await request({ ...edit, expectedRevision: revision() });
      if (!reply) queue.length = 0;
      else if (reply.type === "result" && reply.kind === "draft")
        update({ view: reply.view, ...(edit.type === "add" ? { feedback: null } : {}) });
      else if (reply.type === "error") {
        queue.length = 0;
        report(reply, edit);
      }
    }
  } finally {
    draining = false;
    update({ busy: false });
  }
}

async function search(query: string) {
  if (state.receipt) return;
  const text = query.trim();
  if (!text) return update({ search: { query, status: "idle", matches: [] } });
  update({ search: { ...state.search, query, status: "loading" } });
  const reply = await request({ type: "search", query: text.slice(0, 200) });
  if (state.search.query !== query) return;
  if (reply?.type === "result" && reply.kind === "search")
    update({ search: { query, status: "ready", matches: reply.matches } });
  else update({ search: { query, status: "failed", matches: [] } });
}

function report(reply: BridgeMessage | undefined, edit?: Edit) {
  if (!reply)
    return update({
      operationError:
        "The register connection ended. Reconnect and check Purchases before retrying.",
    });
  if (reply.type !== "error") return;
  const failure = failureOf(reply);
  if (failure) update({ failure, operationError: reply.message });
  else if (reply.code === "REVISION_STALE") {
    update({ operationError: "The basket changed. Check it, then try again." });
    void load();
  } else if (edit?.type === "add" && "code" in edit && reply.code === "PRODUCT_UNKNOWN")
    update({ feedback: { kind: "unknown", code: edit.code } });
  else update({ operationError: reply.message });
}

function snapshot(): SaleSnapshot {
  const connection = connectionSnapshot();
  if (composed?.connection === connection && composed.state === state) return composed.snapshot;
  const { host, status } = connection;
  const value: SaleSnapshot = {
    ...state,
    host,
    loading: state.loading && host !== "disconnected",
    permissions: status?.permissions ?? [],
    register: registerOf(status),
    sync: {
      offline: status?.server === "offline",
      pendingCount: status?.pendingCount ?? 0,
      canSync: canSyncNow(host, status),
      syncing: status?.syncing ?? false,
    },
  };
  composed = { connection, state, snapshot: value };
  return value;
}

function update(change: Partial<State>) {
  if (change.view && isOlder(change.view, state.view)) {
    const { view: _stale, ...rest } = change;
    change = rest;
  }
  change = trackPrint(change, registerOf(connectionSnapshot().status), (saleId) =>
    update({ receiptPrint: unknownIfPending(state.receiptPrint, saleId) }),
  );
  state = { ...state, ...change };
  notify();
}

function notify() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
