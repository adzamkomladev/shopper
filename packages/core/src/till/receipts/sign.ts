import { and, eq, isNotNull, sql } from "drizzle-orm";
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

/** The sales and credit notes this till still holds as provisional VAT receipts, waiting for their signature. */
export async function unsignedLocalReceipts(tx: TillSqlite, orgId: string) {
  const unsigned = (table: typeof localSale | typeof refund) =>
    tx
      .select({ id: table.id })
      .from(table)
      .where(
        and(
          eq(table.orgId, orgId),
          sql`json_extract(${table.receipt}, '$.header.vatInvoice') = 1`,
          sql`json_extract(${table.receipt}, '$.fiscal') IS NULL`,
        ),
      );
  return {
    saleIds: (await unsigned(localSale)).map((row) => row.id),
    refundIds: (await unsigned(refund)).map((row) => row.id),
  };
}
