import { connect } from "node:net";
import { escpos } from "./escpos/encoder";
import type { CashDrawer, PrinterProfile, ReceiptPrinter } from "./types";

export class PrinterOffline extends Error {
  constructor(cause: unknown) {
    super("Printer is offline", { cause });
    this.name = "PrinterOffline";
  }
}

/**
 * Raw TCP (port 9100). A print is complete when the printer closes the socket after our `end`, or,
 * for printers that keep the socket open, when every byte has been flushed and the line goes idle.
 * Failing a flushed job would make a retry print the receipt twice.
 */
export function networkPrinter(options: {
  host: string;
  port?: number;
  timeoutMs?: number;
}): ReceiptPrinter {
  const { host, port = 9100, timeoutMs = 3000 } = options;
  return {
    print: (bytes) =>
      new Promise<void>((resolve, reject) => {
        let flushed = false;
        let failure: unknown;
        const socket = connect({ host, port });
        socket.setTimeout(timeoutMs);
        socket.on("timeout", () =>
          flushed ? socket.destroy() : socket.destroy(new Error(`No response in ${timeoutMs} ms`)),
        );
        socket.on("error", (cause) => (failure ??= cause));
        socket.once("close", () => (failure ? reject(new PrinterOffline(failure)) : resolve()));
        socket.end(bytes, () => (flushed = true));
      }),
  };
}

export function printerDrawer(printer: ReceiptPrinter, profile: PrinterProfile): CashDrawer {
  return { open: () => printer.print(escpos(profile).init().drawer().bytes()) };
}
