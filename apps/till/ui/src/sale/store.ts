import { useSyncExternalStore } from "react";
import type { BridgeMessage } from "@shopper/sync/bridge";
import {
  connectRegister,
  connectionSnapshot,
  request,
  retryUpload,
  subscribeConnection,
} from "../connection/store";
import { canSyncNow } from "../connection/sync";
import type { ConnectionSnapshot } from "../connection/types";
import type { AddInput, SaleActions, SaleFailure, SaleSnapshot } from "./types";

type State = Omit<SaleSnapshot, "host" | "sync">;
type Edit =
  | ({ type: "add" } & AddInput)
  | { type: "setQuantity"; lineId: string; quantityThousandths: number }
  | { type: "removeLine"; lineId: string };

const listeners = new Set<() => void>();
let state: State = {
  loading: true,
  view: null,
  failure: null,
  busy: false,
  search: { query: "", status: "idle", matches: [] },
  feedback: null,
};
let composed: { connection: ConnectionSnapshot; state: State; snapshot: SaleSnapshot } | undefined;
// Edits run one at a time against the latest revision; a scan burst waits here instead of racing.
const queue: Edit[] = [];
let connectedBefore = false;

subscribeConnection(() => {
  const connected = connectionSnapshot().host === "connected";
  // Every (re)connection reloads the basket: an edit whose reply was lost may or may not have applied.
  if (connected && !connectedBefore) void load();
  connectedBefore = connected;
  notify();
});

export function useSaleSnapshot() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const saleActions: SaleActions = {
  search,
  add: (input) => enqueue({ type: "add", ...input }),
  setQuantity: (lineId, quantityThousandths) =>
    enqueue({ type: "setQuantity", lineId, quantityThousandths }),
  removeLine: (lineId) => enqueue({ type: "removeLine", lineId }),
  dismissFeedback: () => update({ feedback: null }),
  syncNow: retryUpload,
  reconnect: () => (connectionSnapshot().host === "connected" ? void load() : connectRegister()),
};

async function load() {
  update({ loading: true });
  const reply = await request({ type: "readDraft" });
  if (!reply) return update({ loading: false });
  if (reply.type === "result" && reply.kind === "draft")
    return update({ loading: false, view: reply.view, failure: null });
  update({ loading: false, failure: failureOf(reply) ?? "storage" });
}

function enqueue(edit: Edit) {
  if (connectionSnapshot().host !== "connected" || state.failure) return;
  queue.push(edit);
  if (!state.busy) void drain();
}

async function drain() {
  update({ busy: true });
  for (let edit = queue.shift(); edit; edit = queue.shift()) {
    const reply = await request({ ...edit, expectedRevision: state.view?.draft?.revision ?? 0 });
    // No reply: the outcome is unknown, so nothing is retried. Reconnecting reloads the basket.
    if (!reply) queue.length = 0;
    else if (reply.type === "result" && reply.kind === "draft")
      update({ view: reply.view, ...(edit.type === "add" ? { feedback: null } : {}) });
    else await rejected(reply, edit);
  }
  update({ busy: false });
}

async function rejected(reply: BridgeMessage, edit: Edit) {
  const failure = failureOf(reply);
  if (failure) {
    queue.length = 0;
    return update({ failure });
  }
  if (reply.type !== "error") return;
  if (reply.code === "REVISION_STALE") {
    queue.length = 0;
    update({
      feedback: { kind: "rejected", message: "The basket changed. Check it, then try again." },
    });
    return load();
  }
  if (edit.type === "add" && "code" in edit && reply.code === "PRODUCT_UNKNOWN")
    return update({ feedback: { kind: "unknown", code: edit.code } });
  update({ feedback: { kind: "rejected", message: reply.message } });
}

async function search(query: string) {
  const text = query.trim();
  if (!text) return update({ search: { query, status: "idle", matches: [] } });
  update({ search: { ...state.search, query, status: "loading" } });
  const reply = await request({ type: "search", query: text.slice(0, 200) });
  // A reply for older text is dropped; the screen only ever shows matches for what is typed now.
  if (state.search.query !== query) return;
  if (reply?.type === "result" && reply.kind === "search")
    update({ search: { query, status: "ready", matches: reply.matches } });
  else update({ search: { query, status: "failed", matches: [] } });
}

function failureOf(reply: BridgeMessage): SaleFailure | undefined {
  if (reply.type !== "error") return undefined;
  if (reply.code === "SESSION_REQUIRED" || reply.code === "session") return "session";
  if (reply.code === "permission" || reply.code === "scope") return "permission";
  if (reply.code === "STORAGE_FAILED") return "storage";
  return undefined;
}

function snapshot(): SaleSnapshot {
  const connection = connectionSnapshot();
  if (composed?.connection === connection && composed.state === state) return composed.snapshot;
  const { host, status } = connection;
  const value: SaleSnapshot = {
    ...state,
    host,
    loading: state.loading && host !== "disconnected",
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
