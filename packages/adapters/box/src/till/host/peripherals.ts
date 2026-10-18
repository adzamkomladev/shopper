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
  // The pole display opens its port per write, so writes go one at a time and only the newest waiting
  // frame is kept: an unplugged display never builds a backlog behind the basket.
  let tail: Promise<unknown> = Promise.resolve();
  let pending: [string, string] | undefined;
  let reloading: Promise<void> = Promise.resolve();

  function show(first: string, second = "") {
    if (!display) return;
    const queued = pending;
    pending = [first, second];
    if (queued) return;
    tail = tail
      .then(() => {
        const frame = pending!;
        pending = undefined;
        return display?.show(frame);
      })
      .catch((error) => console.error("Pole display failed", error));
  }

  async function apply() {
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
  }

  return {
    /** Starts, swaps or stops the scanner and display to match the saved settings. Never throws. */
    reload() {
      reloading = reloading
        .then(apply)
        .catch((error) => console.error("Peripherals reload failed", error));
      return reloading;
    },
    /** After a basket change: every bridge client (the customer display) gets the draft, the pole display the last line and total. */
    basket(view: DraftView) {
      host.broadcast({ type: "draft", view });
      const { draft, quote, settlement } = view;
      const last = draft?.lines.at(-1);
      if (!last) return show("Welcome");
      const quoted = quote.lines.find((line) => line.lineId === last.id);
      const total = settlement?.total ?? quote.totals.gross;
      show(quoted && "name" in quoted ? quoted.name : "", `Total ${ghs(total)}`);
    },
    sold(receipt: ReceiptDocument) {
      host.broadcast({ type: "sold", total: receipt.total, change: receipt.change });
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
