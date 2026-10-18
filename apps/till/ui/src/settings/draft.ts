import * as v from "valibot";
import type { RegisterSettings } from "@shopper/core/schemas";
import { settingsForm, type SerialDraft, type SettingsDraft } from "../schemas/settings";
import type { DeviceFeedback, DraftErrors, PrinterBadge, PrinterStatus } from "./types";

export const newPrinter = {
  model: "epson",
  kind: "network",
  host: "",
  port: "9100",
  printerName: "",
  path: "",
  baudRate: "9600",
} as const;

/** A serial device just switched on, before a port is chosen. */
export const newSerial: SerialDraft = { path: "", baudRate: "9600" };
const serialDraft = (device: RegisterSettings["scanner"]) =>
  device && { path: device.path, baudRate: String(device.baudRate) };

export function toDraft(settings: RegisterSettings): SettingsDraft {
  const { printer, scanner, display, ...rest } = settings;
  return {
    ...rest,
    scanner: serialDraft(scanner),
    display: serialDraft(display),
    printer: printer && {
      ...newPrinter,
      model: printer.model,
      kind: printer.connection.kind,
      ...(printer.connection.kind === "network" && {
        host: printer.connection.host,
        port: String(printer.connection.port),
      }),
      ...(printer.connection.kind === "usb" && { printerName: printer.connection.printerName }),
      ...(printer.connection.kind === "serial" && {
        path: printer.connection.path,
        baudRate: String(printer.connection.baudRate),
      }),
    },
  };
}

const sortedJson = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

export const sameDraft = (a: SettingsDraft, b: SettingsDraft) => sortedJson(a) === sortedJson(b);

/** Fields that can be shown next to their input, keyed by their path in the draft. */
export function validateDraft(draft: SettingsDraft) {
  const result = v.safeParse(settingsForm, draft);
  const errors: DraftErrors = sharedPorts(draft);
  if (result.success && Object.keys(errors).length === 0)
    return { settings: result.output, errors };
  if (!result.success)
    for (const issue of result.issues) errors[v.getDotPath(issue) ?? ""] ??= issue.message;
  return { settings: null, errors };
}

/** The host refuses two serial devices on one port, so say so on every field that picks it. */
function sharedPorts({ printer, scanner, display }: SettingsDraft) {
  const ports = {
    "printer.path": printer?.kind === "serial" ? printer.path.trim() : "",
    "scanner.path": scanner?.path.trim() ?? "",
    "display.path": display?.path.trim() ?? "",
  };
  const errors: DraftErrors = {};
  for (const [key, path] of Object.entries(ports))
    if (path && Object.values(ports).filter((other) => other === path).length > 1)
      errors[key] = "Each serial device needs its own port";
  return errors;
}

/** Never "Connected" without a real job: a ready printer that has not printed yet is "unchecked". */
export function printerBadge(printer: PrinterStatus): PrinterBadge {
  if (printer.state === "unconfigured") return "none";
  if (printer.state === "offline") return "offline";
  return printer.lastJob?.outcome === "printed" ? "connected" : "unchecked";
}

/** What a printer or drawer action is doing or did, in the words shown inline and in the toast. */
export function deviceMessage({ action, status, message }: DeviceFeedback) {
  const test = action === "test";
  if (status === "running") return test ? "Printing test page…" : "Opening drawer…";
  if (status === "done") return test ? "Test page sent to the printer" : "Drawer opened";
  return `${test ? "Test print failed" : "Open drawer failed"}: ${message}`;
}

/** When a print finished, in Accra time. */
export const printTime = (at: number) =>
  new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
