import type { ShopperTransaction } from "@shopper/db-pg";
import { buildRefundReceipt } from "../receipts/build";
import { receiptNames } from "../sales/document";
import type { RefundSnapshot } from "../schemas/till/refund";
import type { SaleSnapshot } from "../schemas/till/sale";

/** The refund receipt the server stores with an accepted refund. */
export async function refundDocument(
  tx: ShopperTransaction,
  snapshot: RefundSnapshot,
  original: { receiptNumber: string | null; customer: SaleSnapshot["customer"] },
) {
  return buildRefundReceipt(snapshot, original, await receiptNames(tx, snapshot));
}
