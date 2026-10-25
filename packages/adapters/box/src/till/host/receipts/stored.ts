import * as v from "valibot";
import { eq } from "drizzle-orm";
import { localSale, refund, type TillDatabase } from "@shopper/db-sqlite";
import { receiptDocument } from "@shopper/core/receipts";
import { TillError } from "@shopper/core/till";

/** The stored receipt of a sale, or of a refund (which has no receipt output of its own). */
export async function storedReceipt(database: TillDatabase, id: string) {
  const [sale] = await database.read((tx) =>
    tx.select({ receipt: localSale.receipt }).from(localSale).where(eq(localSale.id, id)),
  );
  const [refunded] = sale
    ? []
    : await database.read((tx) =>
        tx.select({ receipt: refund.receipt }).from(refund).where(eq(refund.id, id)),
      );
  const stored = sale?.receipt ?? refunded?.receipt;
  if (!stored) throw new TillError("SALE_UNKNOWN", "Receipt is unavailable");
  return v.parse(receiptDocument, stored);
}
