import { printFailure } from "../purchases/delivery";
import type { ReceiptDocument, ReceiptPrint, ReprintFeedback, SaleRegister } from "./types";

/** How long a sale waits for the host to report its receipt print before the cashier is told it is unknown. */
export const PRINT_REPORT_MS = 15_000;

/** The print of a sale that has just completed, already settled if the host's report beat the sale reply. */
export function beginPrint(receipt: ReceiptDocument, register: SaleRegister | null): ReceiptPrint {
  return mirrorJob({ saleId: receipt.saleId, outcome: null, message: null }, register);
}

/**
 * Follows the host's last job when it is a receipt job for this sale. A test print, a drawer job or another
 * sale's receipt says nothing about this one, so the outcome seen stays.
 */
export function mirrorJob(print: ReceiptPrint, register: SaleRegister | null): ReceiptPrint {
  const job = register?.printer.lastJob;
  if (!job || job.kind !== "receipt" || job.saleId !== print.saleId) return print;
  const outcome = job.outcome;
  const message =
    outcome === "failed" ? printFailure(job.message ?? "the printer did not answer") : null;
  return print.outcome === outcome && print.message === message
    ? print
    : { saleId: print.saleId, outcome, message };
}

/** True while the host may still report: auto-print is on and there is a printer. */
export const awaitsReport = (register: SaleRegister | null) =>
  !!register?.printAutomatically && register.printer.state !== "unconfigured";

type Change = { receipt?: ReceiptDocument | null; receiptPrint?: ReceiptPrint | null };

/** Adds the print state a receipt change implies, and starts the report timer for a new receipt. */
export function trackPrint<T extends Change>(
  change: T,
  register: SaleRegister | null,
  timedOut: (saleId: string) => void,
): T {
  const receipt = change.receipt;
  if (receipt === null) return { ...change, receiptPrint: null };
  if (!receipt) return change;
  if (awaitsReport(register)) setTimeout(() => timedOut(receipt.saleId), PRINT_REPORT_MS);
  return { ...change, receiptPrint: beginPrint(receipt, register) };
}

/** A print still pending when the wait ends is unknown. */
export const unknownIfPending = (print: ReceiptPrint | null, saleId: string) =>
  print?.saleId === saleId && print.outcome === null
    ? { ...print, outcome: "unknown" as const }
    : print;

/** The outcome of a print the cashier asked for. */
export const asked = (saleId: string, result: ReprintFeedback): ReceiptPrint => ({
  saleId,
  outcome: result.status === "done" ? "printed" : "failed",
  message: result.message,
});
