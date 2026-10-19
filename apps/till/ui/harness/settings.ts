// Test-only settings state for the till UI harness. `?scenario=settings-…` picks the host state and the failures to inject.
import { useState } from "react";
import type { RegisterSettings } from "@shopper/core/schemas";
import type {
  DeviceFeedback,
  PortList,
  SettingsActions,
  SettingsCurrent,
  SettingsSnapshot,
} from "../src/settings/types";

const printer: NonNullable<RegisterSettings["printer"]> = {
  model: "epson",
  connection: { kind: "network", host: "192.168.1.50", port: 9100 },
};
const value: RegisterSettings = {
  storeName: "Osu Mart",
  registerName: "Front till",
  printAutomatically: true,
  paperMm: 80,
  clearCartAfterSale: true,
  requirePinForReturns: false,
  returnWindowDays: 30,
  printer,
  scanner: null,
  display: null,
};
const ready: SettingsCurrent = {
  revision: 4,
  value,
  canEdit: true,
  printer: { state: "ready", lastJob: null },
  registerCode: "REG-001",
};
const serialPrinter: RegisterSettings = {
  ...value,
  printer: { model: "epson", connection: { kind: "serial", path: "COM3", baudRate: 9600 } },
  scanner: { kind: "serial", path: "COM4", baudRate: 19200 },
  display: { kind: "serial", path: "COM5", baudRate: 9600 },
};
const usbPrinter: RegisterSettings = {
  ...value,
  printer: { model: "xprinter", connection: { kind: "usb", printerName: "Xprinter XP-80C" } },
};
const found: PortList = {
  status: "ready",
  serial: [
    { path: "COM3", manufacturer: "FTDI" },
    { path: "COM4", manufacturer: "Prolific" },
    { path: "COM5" },
  ],
  usb: ["EPSON TM-T20III Receipt", "Xprinter XP-80C"],
};
const printed = { kind: "test", saleId: null, outcome: "printed", message: null } as const;
const refused = {
  kind: "test",
  saleId: null,
  outcome: "failed",
  message: "connection refused (192.168.1.50:9100)",
} as const;

const currents: Record<string, SettingsCurrent> = {
  "settings-connected": { ...ready, printer: { state: "ready", lastJob: printed } },
  "settings-offline": { ...ready, printer: { state: "offline", lastJob: refused } },
  "settings-noprinter": {
    ...ready,
    value: { ...value, printer: null },
    printer: { state: "unconfigured", lastJob: null },
  },
  "settings-readonly": { ...ready, canEdit: false },
  "settings-serial": { ...ready, value: serialPrinter },
  "settings-serial-readonly": { ...ready, value: serialPrinter, canEdit: false },
  "settings-serial-gone": {
    ...ready,
    value: {
      ...value,
      printer: { model: "epson", connection: { kind: "serial", path: "COM9", baudRate: 9600 } },
    },
  },
  "settings-usb": { ...ready, value: usbPrinter },
  "reprint-noprinter": {
    ...ready,
    value: { ...value, printer: null },
    printer: { state: "unconfigured", lastJob: null },
  },
  "reprint-offline": { ...ready, printer: { state: "offline", lastJob: refused } },
  "reprint-58": { ...ready, value: { ...value, paperMm: 58 } },
};
const hostStates = {
  "settings-loading": "connecting",
  "settings-disconnected": "disconnected",
} as const;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useSettingsHarness(
  name: string,
  record: (type: string) => (...args: unknown[]) => void,
): [SettingsSnapshot, SettingsActions] {
  const hostState = hostStates[name as keyof typeof hostStates];
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>({
    host: hostState ?? "connected",
    current: hostState ? null : (currents[name] ?? ready),
    saving: false,
    saveError: null,
    device: null,
    ports: { status: "idle", serial: [], usb: [] },
  });
  const [saves, setSaves] = useState(0);
  const change = (next: Partial<SettingsSnapshot>) => setSnapshot((now) => ({ ...now, ...next }));
  const actions: SettingsActions = {
    async save(settings, expectedRevision) {
      record("saveSettings")(settings, expectedRevision);
      setSaves(saves + 1);
      change({ saving: true, saveError: null });
      await sleep(name === "settings-slow" ? 1200 : 50);
      if (name === "settings-stale")
        return (
          change({
            saving: false,
            saveError: { kind: "stale", message: "Another screen saved first." },
          }),
          false
        );
      if (name === "settings-storage" && saves === 0)
        return (
          change({
            saving: false,
            saveError: {
              kind: "storage",
              message: "Register storage is unavailable. Reconnect and retry.",
            },
          }),
          false
        );
      setSnapshot((now) => ({
        ...now,
        saving: false,
        current: now.current && {
          ...now.current,
          revision: now.current.revision + 1,
          value: settings,
          printer:
            settings.printer && now.current.printer.state !== "unconfigured"
              ? now.current.printer
              : { state: settings.printer ? "ready" : "unconfigured", lastJob: null },
        },
      }));
      return true;
    },
    async listPorts() {
      record("listPorts")();
      setSnapshot((now) => ({ ...now, ports: { ...now.ports, status: "loading" } }));
      await sleep(name === "settings-portsloading" ? 60_000 : 200);
      const ports: PortList =
        name === "settings-portsfail"
          ? { status: "failed", serial: [], usb: [] }
          : name === "settings-noports"
            ? { status: "ready", serial: [], usb: [] }
            : found;
      change({ ports });
    },
    testPrint: () => device("test"),
    openDrawer: () => device("drawer"),
    async reload() {
      record("reloadSettings")();
      if (name === "settings-stale")
        setSnapshot((now) => ({
          ...now,
          saveError: null,
          current: now.current && {
            ...now.current,
            revision: now.current.revision + 1,
            value: { ...now.current.value, storeName: "Other screen" },
          },
        }));
      else change({ saveError: null });
    },
  };
  async function device(action: "test" | "drawer"): Promise<DeviceFeedback> {
    record(action === "test" ? "testPrint" : "openDrawer")();
    change({ device: { action, status: "running", message: null, at: null } });
    await sleep(name === "settings-slowdevice" ? 1200 : 150);
    const failed = name === "settings-printfail" || name === "settings-offline";
    const feedback: DeviceFeedback = {
      action,
      status: failed ? "failed" : "done",
      message: failed ? "Printer is offline. Check power and network." : null,
      at: Date.now(),
    };
    change({ device: feedback });
    return feedback;
  }
  return [snapshot, actions];
}
