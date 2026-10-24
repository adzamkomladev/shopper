import type { ReceiptDocument } from "@shopper/core/receipts";
import { mulRatio, toDecimal, type Money } from "@shopper/money";

export const ghs = (amount: Money) => `GHS ${toDecimal(amount)}`;

/** A VAT buyer's line before tax: "qty x net unit price", and the net line total. */
export function beforeTax(line: ReceiptDocument["lines"][number] & { net: Money }) {
  const unit = mulRatio(line.net, 1000, line.quantityThousandths);
  return [
    `Before tax ${quantity(line.quantityThousandths)} x ${ghs(unit)}`,
    ghs(line.net),
  ] as const;
}

/** Integer thousandths as a trimmed decimal: 1500 → "1.5", 2000 → "2". */
export function quantity(thousandths: number) {
  const fraction = String(thousandths % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${Math.floor(thousandths / 1000)}.${fraction}` : String(thousandths / 1000);
}

type Tender = ReceiptDocument["tenders"][number];

export const tenderLabel = {
  cash: "Cash",
  card: "Card",
  momo: "MoMo",
  credit: "On account",
  loyalty: "Points",
} as const;

export const tenderDetail = (tender: Tender) =>
  tender.approvalCode ?? tender.reference ?? tender.phone;

/** A shop that is VAT-registered issues VAT invoices; any other sale is a plain receipt. */
export const documentTitle = (receipt: ReceiptDocument) =>
  receipt.header.vatInvoice ? "VAT INVOICE" : "RECEIPT";

/** Tax rows in print order; the COVID levy appears only when charged, and a plain receipt carries none. */
export function taxRows(receipt: ReceiptDocument) {
  if (!receipt.header.vatInvoice) return [];
  const { net, nhil, getfund, covid, vat } = receipt.taxSummary;
  const rows: [string, Money][] = [
    ["Net", net],
    ["NHIL", nhil],
    ["GETFund", getfund],
  ];
  if (covid !== 0) rows.push(["COVID", covid]);
  rows.push(["VAT", vat]);
  return rows;
}

/** Placeholder E-VAT payload until the GRA SDC signs receipts. */
export const qrPayload = (receipt: ReceiptDocument) =>
  `${receipt.header.receiptNumber ?? ""}|${receipt.saleId}`;

export const qrCaption = "E-VAT QR pending";

/** The refund payout line: "Refunded (Cash)", "Refunded (Card REF-1)". */
export function refundedLabel(tender: Tender) {
  const reference = tender.reference ? ` ${tender.reference}` : "";
  return `Refunded (${tenderLabel[tender.kind]}${reference})`;
}

/** A line cut to the paper's columns; both renderers print a long name the same way. */
export const clip = (value: string, cols: number) => value.slice(0, cols);
