import { useSyncExternalStore } from "react";
import type { BridgeMessage } from "@shopper/sync/bridge";
import {
  connectRegister,
  connectionSnapshot,
  request,
  subscribeConnection,
} from "../connection/store";
import type { ConnectionSnapshot } from "../connection/types";
import type {
  DeviceAction,
  DeviceFeedback,
  SaveError,
  SettingsActions,
  SettingsSnapshot,
} from "./types";

type State = Pick<SettingsSnapshot, "saving" | "saveError" | "device" | "ports">;
const listeners = new Set<() => void>();
let state: State = {
  saving: false,
  saveError: null,
  device: null,
  ports: { status: "idle", serial: [], usb: [] },
};
let composed:
  | { connection: ConnectionSnapshot; state: State; snapshot: SettingsSnapshot }
  | undefined;
const ended = "The register connection ended. Reconnect and try again.";

subscribeConnection(notify);

export function useSettingsSnapshot() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const settingsActions: SettingsActions = {
  async save(settings, expectedRevision) {
    if (state.saving) return false;
    update({ saving: true, saveError: null });
    const reply = await request({ type: "settings.save", settings, expectedRevision });
    // The connection store has already published the saved settings in the reply's status.
    update({ saving: false, saveError: reply?.type === "result" ? null : saveErrorOf(reply) });
    return reply?.type === "result";
  },
  testPrint: () => device("test", { type: "printer.test" }),
  openDrawer: () => device("drawer", { type: "drawer.test" }),
  async listPorts() {
    if (state.ports.status === "loading") return;
    update({ ports: { ...state.ports, status: "loading" } });
    const reply = await request({ type: "printers.list" });
    update({
      ports:
        reply?.type === "result" && reply.kind === "printers"
          ? { status: "ready", serial: reply.serial, usb: reply.usb }
          : { ...state.ports, status: "failed" },
    });
  },
  async reload() {
    update({ saveError: null });
    if (connectionSnapshot().host === "connected") await request({ type: "status" });
    else connectRegister();
  },
};

async function device(action: DeviceAction, body: { type: "printer.test" | "drawer.test" }) {
  const running = { action, status: "running", message: null, at: null } as const;
  if (state.device?.status === "running") return state.device;
  update({ device: running });
  const reply = await request(body);
  const done = reply?.type === "result";
  const feedback: DeviceFeedback = {
    action,
    status: done ? "done" : "failed",
    message: done ? null : reply?.type === "error" ? reply.message : ended,
    at: Date.now(),
  };
  update({ device: feedback });
  return feedback;
}

function saveErrorOf(reply: BridgeMessage | undefined): SaveError {
  if (reply?.type !== "error") return { kind: "storage", message: ended };
  if (reply.code === "REVISION_STALE") return { kind: "stale", message: reply.message };
  if (reply.code === "permission" || reply.code === "scope")
    return { kind: "permission", message: "Ask a manager to change register settings." };
  return { kind: "storage", message: reply.message };
}

function snapshot(): SettingsSnapshot {
  const connection = connectionSnapshot();
  if (composed?.connection === connection && composed.state === state) return composed.snapshot;
  const { host, status } = connection;
  const value: SettingsSnapshot = {
    ...state,
    host,
    current:
      host === "connected" && status
        ? { ...status.settings, printer: status.printer, registerCode: status.registerCode }
        : null,
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
