import * as v from "valibot";
import { registerSettings } from "@shopper/core/schemas";

const printer = registerSettings.entries.printer.wrapped.entries;

const name = (empty: string) =>
  v.pipe(v.string(), v.trim(), v.nonEmpty(empty), v.maxLength(100, "Use 100 characters or fewer"));

const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const hostname =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const portMessage = "Enter a port from 1 to 65535";

const hostMessage = "Enter an IP address like 192.168.1.50 or a host name";
const baudRates = ["9600", "19200", "38400", "57600", "115200"];
/** An IPv4 address or a host name. A dotted run of digits is an address, so 999.1.1.1 is rejected. */
const isHost = (input: string) => {
  const value = input.trim();
  return /^[\d.]+$/.test(value) ? ipv4.test(value) : hostname.test(value);
};
const isPort = (input: string) => /^\d{1,5}$/.test(input.trim()) && +input >= 1 && +input <= 65535;

/** The register settings form as typed by the cashier: ports are text until they are checked. */
export const settingsForm = v.object({
  storeName: name("Enter the store name"),
  registerName: name("Enter the register name"),
  printAutomatically: v.boolean(),
  paperMm: registerSettings.entries.paperMm,
  clearCartAfterSale: v.boolean(),
  requirePinForReturns: v.boolean(),
  scanner: registerSettings.entries.scanner,
  display: registerSettings.entries.display,
  printer: v.nullable(
    v.pipe(
      v.object({
        model: printer.model,
        kind: v.picklist(["network", "usb", "serial"]),
        host: v.string(),
        port: v.string(),
        printerName: v.string(),
        path: v.string(),
        baudRate: v.string(),
      }),
      v.forward(
        v.partialCheck(
          [["kind"], ["host"]],
          (p) => p.kind !== "network" || isHost(p.host),
          hostMessage,
        ),
        ["host"],
      ),
      v.forward(
        v.partialCheck(
          [["kind"], ["port"]],
          (p) => p.kind !== "network" || isPort(p.port),
          portMessage,
        ),
        ["port"],
      ),
      v.forward(
        v.partialCheck(
          [["kind"], ["printerName"]],
          (p) => p.kind !== "usb" || (p.printerName.trim() !== "" && p.printerName.length <= 128),
          "Enter the printer name as Windows lists it",
        ),
        ["printerName"],
      ),
      v.forward(
        v.partialCheck(
          [["kind"], ["path"]],
          (p) => p.kind !== "serial" || (p.path.trim() !== "" && p.path.length <= 128),
          "Enter the port, like COM3 or /dev/ttyUSB0",
        ),
        ["path"],
      ),
      v.forward(
        v.partialCheck(
          [["kind"], ["baudRate"]],
          (p) => p.kind !== "serial" || baudRates.includes(p.baudRate),
          "Choose a baud rate",
        ),
        ["baudRate"],
      ),
      v.transform((p) => ({
        model: p.model,
        connection:
          p.kind === "network"
            ? { kind: "network" as const, host: p.host.trim(), port: Number(p.port.trim()) }
            : p.kind === "usb"
              ? { kind: "usb" as const, printerName: p.printerName.trim() }
              : {
                  kind: "serial" as const,
                  path: p.path.trim(),
                  baudRate: Number(p.baudRate) as 9600,
                },
      })),
    ),
  ),
});

export type SettingsDraft = Omit<v.InferInput<typeof settingsForm>, "printer"> & {
  printer: null | {
    model: v.InferInput<typeof printer.model>;
    kind: "network" | "usb" | "serial";
    host: string;
    port: string;
    printerName: string;
    path: string;
    baudRate: string;
  };
};
