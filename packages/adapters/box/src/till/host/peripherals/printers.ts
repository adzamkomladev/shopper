import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ReceiptPrinter } from "@shopper/hardware";
import { networkPrinter } from "@shopper/hardware/network";
import { listSerialPorts, serialPrinter } from "@shopper/hardware/serial";
import { spoolerPrinter, windowsPowerShell } from "@shopper/hardware/spooler";
import type { RegisterSettings } from "@shopper/core/schemas";

type Connection = NonNullable<RegisterSettings["printer"]>["connection"];

/** The driver for the configured connection; a drawer kick goes through the same printer. */
export function printerFor(connection: Connection): ReceiptPrinter {
  switch (connection.kind) {
    case "network":
      return networkPrinter({ host: connection.host, port: connection.port });
    case "usb":
      return spoolerPrinter({ printerName: connection.printerName });
    case "serial":
      return serialPrinter({ path: connection.path, baudRate: connection.baudRate });
  }
}

export function describeConnection(connection: Connection) {
  switch (connection.kind) {
    case "network":
      return `${connection.host}:${connection.port}`;
    case "usb":
      return connection.printerName;
    case "serial":
      return `${connection.path} @ ${connection.baudRate}`;
  }
}

/** Serial ports, plus installed printer names on Windows only (the spooler is the only USB path). */
export async function listPrinters(options: { platform?: string; shell?: string } = {}) {
  const serial = await listSerialPorts().catch(() => []);
  if ((options.platform ?? process.platform) !== "win32") return { serial, usb: [] };
  const usb = await promisify(execFile)(
    options.shell ?? windowsPowerShell,
    ["-NoProfile", "-NonInteractive", "-Command", "Get-Printer | Select -Expand Name"],
    { windowsHide: true, timeout: 10_000 },
  ).then(
    ({ stdout }) =>
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    () => [],
  );
  return { serial, usb };
}
