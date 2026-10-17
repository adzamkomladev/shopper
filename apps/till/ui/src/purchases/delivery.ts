import type { ReceiptDelivery } from "@shopper/sync/bridge";
import type { PurchaseOutput } from "../sale/types";
import type { SettingsCurrent } from "../settings/types";

/** A printer fault in words that say what to do next. */
export const printFailure = (message: string) =>
  `Print failed: ${message.replace(/\.$/, "")}. Check the printer is on and on the same network.`;

export function deliveryText({ printedAt, printError, reprints }: ReceiptDelivery) {
  if (printError) return printFailure(printError);
  if (!printedAt) return "Not printed";
  return reprints > 0 ? `Printed · reprinted ${reprints}×` : "Printed";
}

export const digitalCopyText = ({ pdf }: ReceiptDelivery) =>
  pdf === "uploaded" ? "Uploaded" : pdf === "pending" ? "Waiting to upload" : "Not stored";

/** The register's printer and paper from its settings, and the cashier's right to reprint. */
export function purchaseOutput(
  current: SettingsCurrent | null,
  permissions: string[],
): PurchaseOutput | null {
  return (
    current && {
      printer: current.printer.state,
      paperMm: current.value.paperMm,
      canReprint: permissions.includes("sale.create"),
    }
  );
}

/** Why Reprint is unavailable, or null when it can run. */
export function reprintBlock(output: PurchaseOutput | null) {
  if (!output) return "The register host is offline";
  if (!output.canReprint) return "Your role cannot reprint receipts";
  if (output.printer === "unconfigured") return "Add a printer in Settings";
  return null;
}
