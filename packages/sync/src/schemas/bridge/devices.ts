import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { registerSettings } from "@shopper/core/schemas";

const id = uuidV7Schema;

export const deviceRequests = [
  v.strictObject({
    id,
    type: v.literal("settings.save"),
    settings: registerSettings,
    expectedRevision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  }),
  v.strictObject({ id, type: v.literal("printer.test") }),
  v.strictObject({ id, type: v.literal("drawer.test") }),
  v.strictObject({ id, type: v.literal("receipt.print"), saleId: id }),
  v.strictObject({ id, type: v.literal("printers.list") }),
] as const;
export const deviceRequestTypes = deviceRequests.map((schema) => schema.entries.type.literal);

export const settingsStatus = v.strictObject({
  revision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  value: registerSettings,
  canEdit: v.boolean(),
});
export const printerStatus = v.strictObject({
  state: v.picklist(["unconfigured", "ready", "offline"]),
  lastJob: v.nullable(
    v.strictObject({
      /** What the job was: a kick-only job is a drawer job and never a printed receipt. */
      kind: v.picklist(["receipt", "test", "drawer", "report"]),
      saleId: v.nullable(id),
      outcome: v.picklist(["printed", "failed"]),
      message: v.nullable(v.string()),
    }),
  ),
});
/** Ports and Windows printers the host can see, for the settings pickers. */
export const printerList = v.strictObject({
  id,
  type: v.literal("result"),
  kind: v.literal("printers"),
  serial: v.array(v.strictObject({ path: v.string(), manufacturer: v.optional(v.string()) })),
  usb: v.array(v.string()),
});
/** One barcode from the serial scanner, pushed to every authorized bridge client. */
export const scanMessage = v.strictObject({ type: v.literal("scan"), code: v.string() });
export type SettingsStatus = v.InferOutput<typeof settingsStatus>;
export type PrinterStatus = v.InferOutput<typeof printerStatus>;
