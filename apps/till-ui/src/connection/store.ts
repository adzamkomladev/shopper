import { useSyncExternalStore } from "react";
import { buildInfo } from "@shopper/config";
import { bridgeMessage, type BridgeRequest, type HostStatus } from "@shopper/sync/bridge";
import { v7 } from "uuid";
import * as v from "valibot";

export type HostConnection = "disconnected" | "connecting" | "connected";
export type ConnectionSnapshot = {
  host: HostConnection;
  status: HostStatus | null;
  error: string | null;
};

const listeners = new Set<() => void>();
let snapshot: ConnectionSnapshot = { host: "disconnected", status: null, error: null };
let capability: string | undefined;
let socket: WebSocket | undefined;
let initialized = false;
const pending = new Set<string>();

export function useConnectionSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
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
  pending.clear();
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
    if (socket === current)
      publish({
        host: "disconnected",
        error: "Cannot reach the register host. Start it, then reconnect.",
      });
  };
  current.onclose = () => {
    if (socket !== current) return;
    socket = undefined;
    pending.clear();
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
    publish({ host: "connected", status: message.status, error: null });
    return;
  }
  if (!message.id || !pending.delete(message.id)) return fail(current);
  if (message.type === "error") {
    publish({ host: "disconnected", error: message.message });
    current.close();
  } else if (message.kind === "status") {
    publish({ host: "connected", status: message.status, error: null });
  }
}

function send(request: BridgeRequest, current: WebSocket) {
  pending.add(request.id);
  current.send(JSON.stringify(request));
}

function fail(current: WebSocket) {
  if (socket !== current) return;
  pending.clear();
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
