import { and, eq } from "drizzle-orm";
import { fiscalDoc, type ShopperTransaction } from "@shopper/db-pg";
import { fiscalPayload } from "../receipts/fiscal";
import type { ReceiptDocument } from "../schemas/receipts/document";

type Source = { storeId: string; branchId: string } & (
  | { saleId: string; refundId?: never }
  | { refundId: string; saleId?: never }
);

/**
 * Records a VAT invoice or credit note as a pending fiscal document, inside the command that accepted it. A receipt
 * that is not a VAT invoice, or has no number to sign, is not fiscalised. The SDC is never called here.
 */
export async function recordFiscalDoc(
  tx: ShopperTransaction,
  orgId: string,
  receipt: ReceiptDocument,
  source: Source,
) {
  if (!receipt.header.vatInvoice || !receipt.header.receiptNumber) return null;
  const payload = fiscalPayload(receipt);
  const [row] = await tx
    .insert(fiscalDoc)
    .values({
      orgId,
      storeId: source.storeId,
      branchId: source.branchId,
      kind: payload.type,
      saleId: source.saleId ?? null,
      refundId: source.refundId ?? null,
      invoiceNumber: receipt.header.receiptNumber,
      payload,
    })
    .returning({ id: fiscalDoc.id });
  return row!.id;
}

/** The fiscal document a replayed sale or refund already made, if it made one. */
export async function fiscalDocOf(
  tx: ShopperTransaction,
  orgId: string,
  source: { saleId: string } | { refundId: string },
): Promise<string | null> {
  const [row] = await tx
    .select({ id: fiscalDoc.id })
    .from(fiscalDoc)
    .where(
      and(
        eq(fiscalDoc.orgId, orgId),
        "saleId" in source
          ? eq(fiscalDoc.saleId, source.saleId)
          : eq(fiscalDoc.refundId, source.refundId),
      ),
    );
  return row?.id ?? null;
}
