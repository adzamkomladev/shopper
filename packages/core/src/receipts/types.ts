import type { ReceiptDocument } from "../schemas/receipts/document";
export type { ReceiptReference } from "../schemas/receipts/reference";

/** What a fiscal submission carries: the seller, the buyer, the lines and the totals of a receipt. */
export type FiscalPayload = {
  /** A credit note reverses part of `originalInvoiceNumber`. */
  type: "invoice" | "credit_note";
  invoiceNumber: string | null;
  originalInvoiceNumber: string | null;
  issuedAt: string;
  seller: { name: string; tin: string | null };
  buyer: { name: string; tin: string } | null;
  lines: Pick<
    ReceiptDocument["lines"][number],
    "name" | "quantityThousandths" | "unitPrice" | "taxClass" | "gross" | "net"
  >[];
  totals: Pick<ReceiptDocument["taxSummary"], "net" | "nhil" | "getfund" | "covid" | "vat"> & {
    total: ReceiptDocument["total"];
  };
};
