import { money, toDecimal } from "@shopper/money";
import { readRegisterSettings } from "@shopper/core/till";
import type { ReceiptDocument } from "@shopper/core/receipts";
import { serialDisplay, serialScanner } from "@shopper/hardware/serial";
import type { CustomerDisplay } from "@shopper/hardware";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { BridgeMessage, DraftView } from "@shopper/sync/bridge";
import type { HostConfiguration } from "./config";

type Serial = { path: string; baudRate: number } | null;
const ghs = (amount: number) => `GHS ${toDecimal(money(amount))}`;

/**
 * The serial scanner and pole display. A keyboard-wedge scanner (`null`) needs nothing here. Display
 * and scanner faults are logged: a peripheral never fails a basket change or a sale.
 */
export function createPeripherals(host: {
  database: TillDatabase;
  config: HostConfiguration;
  broadcast: (message: BridgeMessage) => void;
}) {
  let scannerKey = "null";
  let stopScanner: (() => void) | undefined;
  let display: CustomerDisplay | undefined;
  // The pole display opens its port per write, so writes go one at a time, in order.
  let tail: Promise<unknown> = Promise.resolve();

  function show(first: string, second = "") {
    const target = display;
    if (!target) return;
    tail = tail
      .then(() => target.show([first, second]))
      .catch((error) => console.error("Pole display failed", error));
  }

  return {
    /** Starts, swaps or stops the scanner and display to match the saved settings. */
    async reload() {
      const { value } = await readRegisterSettings(host.database, host.config.identity);
      const scanner: Serial = value.scanner;
      if (JSON.stringify(scanner) !== scannerKey) {
        scannerKey = JSON.stringify(scanner);
        stopScanner?.();
        stopScanner = scanner
          ? serialScanner({
              ...scanner,
              onError: (error) => console.error("Serial scanner failed", error),
            }).onScan((code) => host.broadcast({ type: "scan", code }))
          : undefined;
      }
      display = value.display ? serialDisplay(value.display) : undefined;
    },
    /** After a basket change: the last line and the total. */
    basket({ draft, quote, settlement }: DraftView) {
      const last = draft?.lines.at(-1);
      if (!last) return show("Welcome");
      const quoted = quote.lines.find((line) => line.lineId === last.id);
      const total = settlement?.total ?? quote.totals.gross;
      show(quoted && "name" in quoted ? quoted.name : "", `Total ${ghs(total)}`);
    },
    sold(receipt: ReceiptDocument) {
      const cash = receipt.tenders.some((tender) => tender.kind === "cash");
      if (cash) show(`Change ${ghs(receipt.change)}`, "Thank you");
      else show("Thank you");
    },
    async close() {
      stopScanner?.();
      await tail;
    },
  };
}
