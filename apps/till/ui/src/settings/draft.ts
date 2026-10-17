import * as v from "valibot";
import type { RegisterSettings } from "@shopper/core/schemas";
import { settingsForm, type SettingsDraft } from "../schemas/settings";
import type { DeviceFeedback, DraftErrors, PrinterBadge, PrinterStatus } from "./types";

export const newPrinter = { model: "epson", host: "", port: "9100" } as const;

export function toDraft(settings: RegisterSettings): SettingsDraft {
  const { printer, ...rest } = settings;
  return {
    ...rest,
    printer: printer && {
      model: printer.model,
      host: printer.connection.host,
      port: String(printer.connection.port),
    },
  };
}

export const sameDraft = (a: SettingsDraft, b: SettingsDraft) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Fields that can be shown next to their input, keyed by their path in the draft. */
export function validateDraft(draft: SettingsDraft) {
  const result = v.safeParse(settingsForm, draft);
  if (result.success) return { settings: result.output, errors: {} as DraftErrors };
  const errors: DraftErrors = {};
  for (const issue of result.issues) errors[v.getDotPath(issue) ?? ""] ??= issue.message;
  return { settings: null, errors };
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
