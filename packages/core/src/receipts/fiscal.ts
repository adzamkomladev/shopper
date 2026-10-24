import type { ReceiptDocument } from "../schemas/receipts/document";
import type { FiscalPayload } from "./types";

/** The part of a receipt a fiscal submission carries. Pure: the same receipt always gives the same payload. */
export function fiscalPayload(receipt: ReceiptDocument): FiscalPayload {
  const { header, taxSummary } = receipt;
  return {
    type: receipt.kind === "refund" ? "credit_note" : "invoice",
    invoiceNumber: header.receiptNumber,
    originalInvoiceNumber: receipt.refundOf,
    issuedAt: header.utcTime,
    seller: { name: header.org, tin: header.tin },
    buyer: receipt.buyer,
    lines: receipt.lines.map(({ name, quantityThousandths, unitPrice, taxClass, gross, net }) => ({
      name,
      quantityThousandths,
      unitPrice,
      taxClass,
      gross,
      net,
    })),
    totals: {
      net: taxSummary.net,
      nhil: taxSummary.nhil,
      getfund: taxSummary.getfund,
      covid: taxSummary.covid,
      vat: taxSummary.vat,
      total: receipt.total,
    },
  };
}
