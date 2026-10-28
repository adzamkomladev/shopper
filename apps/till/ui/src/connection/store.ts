import type { ConnectionSnapshot } from "./types";
export type { HostConnection, ConnectionSnapshot } from "./types";
import { useSyncExternalStore } from "react";
import { buildInfo } from "@shopper/config";
import {
  bridgeMessage,
  connectionErrors,
  type BridgeMessage,
  type BridgeRequest,
} from "@shopper/sync/bridge";
import { v7 } from "uuid";
import * as v from "valibot";

const listeners = new Set<() => void>();
const messageListeners = new Set<(message: BridgeMessage) => void>();
let snapshot: ConnectionSnapshot = { host: "disconnected", status: null, error: null };
let capability: string | undefined;
let socket: WebSocket | undefined;
let initialized = false;
// After enrolment the host closes this socket and comes back as an enrolled till on the same port.
let rejoining = 0;
// A waiter gets the reply to its request, or undefined when the connection ended first (outcome unknown).
type Waiter = (reply: BridgeMessage | undefined) => void;
const pending = new Map<string, Waiter | undefined>();

export function useConnectionSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

export const connectionSnapshot = () => snapshot;
/** The bridge capability the host handed this page; `/desktop/unlock` trades it for the back-office cookie. */
export const registerCapability = () => capability;
export { subscribe as subscribeConnection };
export function subscribeBridge(listener: (message: BridgeMessage) => void) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

/** Sends one request; resolves with its reply, or undefined when the connection ended before it answered. */
export function request(body: DistributiveOmit<BridgeRequest, "id">) {
  return new Promise<BridgeMessage | undefined>((resolve) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || snapshot.host !== "connected")
      return resolve(undefined);
    send({ ...body, id: v7() } as BridgeRequest, socket, resolve);
  });
}

export function initializeConnection() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  capability = readCapability();
  if (capability) connectRegister();
}

export function connectRegister() {
  const token = capability;
  if (!token) {
    publish({
      host: "disconnected",
      error: "Open the connection link from this register to connect.",
    });
    return;
  }
  const previous = socket;
  socket = undefined;
  previous?.close();
  settle();
  publish({ host: "connecting", error: null });
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const current = new WebSocket(`${protocol}//${window.location.host}/bridge`);
  socket = current;
  current.onopen = () => {
    if (socket !== current) return;
    send(
      {
        id: v7(),
        type: "hello",
        capability: token,
        appVersion: buildInfo.version,
        protocol: buildInfo.syncProtocol,
      },
      current,
    );
  };
  current.onmessage = (event) => receive(event.data, current);
  current.onerror = () => {
    if (socket === current && rejoining === 0)
      publish({
        host: "disconnected",
        error: "Cannot reach the register host. Start it, then reconnect.",
      });
  };
  current.onclose = () => {
    if (socket !== current) return;
    socket = undefined;
    settle();
    if (rejoining > 0) {
      rejoining -= 1;
      publish({ host: "connecting", error: null });
      setTimeout(connectRegister, 500);
      return;
    }
    publish({
      host: "disconnected",
      error: snapshot.error ?? "Register host disconnected. Reconnect when it is available.",
    });
  };
}

export function retryUpload() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    publish({ ...snapshot, error: "Connect to the register host before retrying uploads." });
    return;
  }
  send({ id: v7(), type: "retry" }, socket);
}

function receive(data: unknown, current: WebSocket) {
  if (socket !== current || typeof data !== "string") return fail(current);
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return fail(current);
  }
  const parsed = v.safeParse(bridgeMessage, raw);
  if (!parsed.success) return fail(current);
  const message = parsed.output;
  if (message.type === "status") {
    rejoining = 0;
    publish({ host: "connected", status: message.status, error: null, unenrolled: false });
    return;
  }
  if (message.type === "draft") {
    for (const listener of messageListeners) listener(message);
    return;
  }
  if (message.type === "payment" || message.type === "scan" || message.type === "sold") {
    for (const listener of messageListeners) listener(message);
    return;
  }
  if (!message.id || !pending.has(message.id)) return fail(current);
  const waiter = pending.get(message.id);
  if (message.type === "error" && connectionErrors.includes(message.code)) {
    settle();
    publish({ host: "disconnected", error: message.message });
    current.close();
    return;
  }
  pending.delete(message.id);
  // Any other error answers one request; the connection stays usable.
  if (message.type === "error" && !waiter) publish({ error: message.message });
  if (message.type === "result" && message.kind === "status") {
    rejoining = 0;
    publish({ host: "connected", status: message.status, error: null, unenrolled: false });
  }
  if (message.type === "result" && message.kind === "unenrolled")
    publish({ host: "connected", status: null, error: null, unenrolled: true });
  if (message.type === "result" && message.kind === "enrolled") rejoining = 40;
  waiter?.(message);
}

function send(request: BridgeRequest, current: WebSocket, waiter?: Waiter) {
  pending.set(request.id, waiter);
  current.send(JSON.stringify(request));
}

function settle() {
  const waiters = [...pending.values()];
  pending.clear();
  for (const waiter of waiters) waiter?.(undefined);
}

function fail(current: WebSocket) {
  if (socket !== current) return;
  settle();
  publish({
    host: "disconnected",
    error: "The register sent an invalid response. Reconnect to try again.",
  });
  current.close();
}

function readCapability() {
  const raw = window.location.hash.slice(1);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  try {
    const value = decodeURIComponent(raw);
    return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function publish(update: Partial<ConnectionSnapshot>) {
  snapshot = { ...snapshot, ...update };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
