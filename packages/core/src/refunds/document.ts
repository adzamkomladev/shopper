import type { ShopperTransaction } from "@shopper/db-pg";
import { buildRefundReceipt } from "../receipts/build";
import { receiptNames } from "../sales/document";
import type { RefundSnapshot } from "../schemas/till/refund";

/** The refund receipt the server stores with an accepted refund. */
export async function refundDocument(
  tx: ShopperTransaction,
  snapshot: RefundSnapshot,
  originalReceipt: string | null,
) {
  return buildRefundReceipt(
    snapshot,
    { receiptNumber: originalReceipt },
    await receiptNames(tx, snapshot),
  );
}
