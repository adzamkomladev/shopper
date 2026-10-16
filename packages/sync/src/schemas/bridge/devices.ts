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
      saleId: v.nullable(id),
      outcome: v.picklist(["printed", "failed"]),
      message: v.nullable(v.string()),
    }),
  ),
});
export type SettingsStatus = v.InferOutput<typeof settingsStatus>;
export type PrinterStatus = v.InferOutput<typeof printerStatus>;
