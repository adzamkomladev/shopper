import * as v from "valibot";
import { tillSession } from "./session";

const name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100));
const device = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128));

/** A COM port or tty; also the scanner and pole display connection. */
const serialConnection = v.strictObject({
  kind: v.literal("serial"),
  path: device,
  baudRate: v.picklist([9600, 19200, 38400, 57600, 115200]),
});

/** GHS 5: a shift whose every tender is within this of its count closes without a manager. */
export const DEFAULT_VARIANCE_THRESHOLD = 50_000;

/** Per-register settings, edited with `register.settings` and kept in till SQLite. */
export const registerSettings = v.strictObject({
  storeName: name,
  registerName: name,
  printAutomatically: v.boolean(),
  paperMm: v.picklist([80, 58]),
  clearCartAfterSale: v.boolean(),
  requirePinForReturns: v.boolean(),
  /** Days after a sale that a cashier may refund it without a manager. */
  returnWindowDays: v.optional(
    v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(365)),
    30,
  ),
  /** The largest cash, card or MoMo variance a shift closes with alone; over it a manager approves. */
  varianceThreshold: v.optional(
    v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10_000_000)),
    DEFAULT_VARIANCE_THRESHOLD,
  ),
  printer: v.nullable(
    v.strictObject({
      model: v.picklist(["epson", "xprinter", "bixolon"]),
      connection: v.variant("kind", [
        v.strictObject({
          kind: v.literal("network"),
          host: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(253)),
          port: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(65535)),
        }),
        v.strictObject({ kind: v.literal("usb"), printerName: device }),
        serialConnection,
      ]),
    }),
  ),
  /** `null` is a keyboard-wedge scanner, which needs no host support. */
  scanner: v.optional(v.nullable(serialConnection), null),
  /** `null` uses the second screen when there is one, else nothing. */
  display: v.optional(v.nullable(serialConnection), null),
});

export type RegisterSettings = v.InferOutput<typeof registerSettings>;

export const saveRegisterInput = v.object({
  settings: v.pipe(
    registerSettings,
    // The scanner keeps its port open, so two devices on one port would fail every write.
    v.check((settings) => {
      const paths = [settings.printer?.connection, settings.scanner, settings.display].flatMap(
        (connection) => (connection?.kind === "serial" ? [connection.path] : []),
      );
      return new Set(paths).size === paths.length;
    }, "Each serial device needs its own port"),
  ),
  expectedRevision: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  session: tillSession,
  at: v.date(),
});
