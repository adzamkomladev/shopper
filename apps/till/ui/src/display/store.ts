import { useSyncExternalStore } from "react";
import {
  connectRegister,
  connectionSnapshot,
  request,
  subscribeBridge,
  subscribeConnection,
} from "../connection/store";
import type { DraftView } from "../sale/types";
import type { DisplaySnapshot } from "./types";

const PAID_MS = 8000;
const RETRY_MS = 3000;
const listeners = new Set<() => void>();
let state = {
  view: null as DraftView | null,
  sold: null as DisplaySnapshot["sold"],
  session: true,
};
let composed:
  | { host: unknown; status: unknown; state: typeof state; value: DisplaySnapshot }
  | undefined;
let paidTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let connectedBefore = false;

/** Starts listening to the host; only the `?display` page calls it, so the register never retries by itself. */
export function initializeDisplay() {
  subscribeBridge((message) => {
    if (message.type === "draft") update({ view: message.view, sold: null, session: true });
    if (message.type === "sold") {
      update({ view: null, sold: { total: message.total, change: message.change } });
      clearTimeout(paidTimer);
      paidTimer = setTimeout(() => update({ sold: null }), PAID_MS);
    }
  });
  subscribeConnection(() => {
    const { host } = connectionSnapshot();
    if (host === "connected" && !connectedBefore) void load();
    connectedBefore = host === "connected";
    // The display has no controls, so a lost host is retried until it answers.
    if (host === "disconnected" && !retryTimer)
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        connectRegister();
      }, RETRY_MS);
    for (const listener of listeners) listener();
  });
}

export function useDisplaySnapshot() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

async function load() {
  const reply = await request({ type: "readDraft" });
  if (reply?.type === "result" && reply.kind === "draft")
    update({ view: reply.view, session: true });
  else if (reply?.type === "error") update({ session: false });
}

function update(change: Partial<typeof state>) {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

function snapshot(): DisplaySnapshot {
  const { host, status } = connectionSnapshot();
  if (composed?.host === host && composed.status === status && composed.state === state)
    return composed.value;
  const value = {
    closed: host === "disconnected" || !state.session,
    storeName: status?.settings.value.storeName ?? null,
    view: state.view,
    sold: state.sold,
  };
  composed = { host, status, state, value };
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
