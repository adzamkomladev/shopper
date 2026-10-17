import * as v from "valibot";
import { tillSession } from "./session";

const name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100));

/** Per-register settings, edited with `register.settings` and kept in till SQLite. */
export const registerSettings = v.strictObject({
  storeName: name,
  registerName: name,
  printAutomatically: v.boolean(),
  paperMm: v.picklist([80, 58]),
  clearCartAfterSale: v.boolean(),
  // Stored now, enforced when returns land.
  requirePinForReturns: v.boolean(),
  printer: v.nullable(
    v.strictObject({
      model: v.picklist(["epson", "xprinter", "bixolon"]),
      connection: v.strictObject({
        kind: v.literal("network"),
        host: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(253)),
        port: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(65535)),
      }),
    }),
  ),
});

export type RegisterSettings = v.InferOutput<typeof registerSettings>;

export const saveRegisterInput = v.object({
  settings: registerSettings,
  expectedRevision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  session: tillSession,
  at: v.date(),
});
