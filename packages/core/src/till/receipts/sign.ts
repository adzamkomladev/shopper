import { and, eq, isNotNull } from "drizzle-orm";
import * as v from "valibot";
import { localSale, receiptOutput, refund, type TillSqlite } from "@shopper/db-sqlite";
import { receiptDocument } from "../../schemas/receipts/document";
import type { TillFiscalSignature } from "../../schemas/till/reference";

/**
 * Adds the SDC's signature to the receipt this till holds for the signed sale or credit note, so a reprint is the
 * definitive receipt. A sale's digital PDF, rendered while it was provisional, is marked to render again. Signatures
 * for another register's documents are ignored.
 */
export async function signLocalReceipt(tx: TillSqlite, orgId: string, signed: TillFiscalSignature) {
  const fiscal = {
    sdcId: signed.sdcId,
    counter: signed.counter,
    signature: signed.signature,
    qr: signed.qr,
    signedAt: signed.signedAt,
  };
  const table = signed.saleId ? localSale : refund;
  const id = (signed.saleId ?? signed.refundId)!;
  const [held] = await tx
    .select({ receipt: table.receipt })
    .from(table)
    .where(and(eq(table.orgId, orgId), eq(table.id, id)));
  if (!held?.receipt) return;
  const receipt = { ...v.parse(receiptDocument, held.receipt), fiscal };
  await tx
    .update(table)
    .set({ receipt })
    .where(and(eq(table.orgId, orgId), eq(table.id, id)));
  if (signed.saleId)
    await tx
      .update(receiptOutput)
      .set({ pdfStale: true })
      .where(and(eq(receiptOutput.saleId, signed.saleId), isNotNull(receiptOutput.pdf)));
}
