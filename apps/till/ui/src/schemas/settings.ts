import * as v from "valibot";
import { registerSettings } from "@shopper/core/schemas";

const printer = registerSettings.entries.printer.wrapped.entries;

const name = (empty: string) =>
  v.pipe(v.string(), v.trim(), v.nonEmpty(empty), v.maxLength(100, "Use 100 characters or fewer"));

const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const hostname =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const portMessage = "Enter a port from 1 to 65535";

/** An IPv4 address or a host name. A dotted run of digits is an address, so 999.1.1.1 is rejected. */
const host = v.pipe(
  v.string(),
  v.trim(),
  v.check(
    (value) => (/^[\d.]+$/.test(value) ? ipv4.test(value) : hostname.test(value)),
    "Enter an IP address like 192.168.1.50 or a host name",
  ),
);

/** The register settings form as typed by the cashier: ports are text until they are checked. */
export const settingsForm = v.object({
  storeName: name("Enter the store name"),
  registerName: name("Enter the register name"),
  printAutomatically: v.boolean(),
  paperMm: registerSettings.entries.paperMm,
  clearCartAfterSale: v.boolean(),
  requirePinForReturns: v.boolean(),
  printer: v.nullable(
    v.pipe(
      v.object({
        model: printer.model,
        host,
        port: v.pipe(
          v.string(),
          v.trim(),
          v.regex(/^\d{1,5}$/, portMessage),
          v.transform(Number),
          v.minValue(1, portMessage),
          v.maxValue(65535, portMessage),
        ),
      }),
      v.transform(({ model, host, port }) => ({
        model,
        connection: { kind: "network" as const, host, port },
      })),
    ),
  ),
});

export type SettingsDraft = Omit<v.InferInput<typeof settingsForm>, "printer"> & {
  printer: null | { model: v.InferInput<typeof printer.model>; host: string; port: string };
};
