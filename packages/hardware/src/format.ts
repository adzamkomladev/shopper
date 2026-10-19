import type { ReceiptDocument } from "@shopper/core/receipts";
import { toDecimal, type Money } from "@shopper/money";

export const ghs = (amount: Money) => `GHS ${toDecimal(amount)}`;

/** Integer thousandths as a trimmed decimal: 1500 → "1.5", 2000 → "2". */
export function quantity(thousandths: number) {
  const fraction = String(thousandths % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${Math.floor(thousandths / 1000)}.${fraction}` : String(thousandths / 1000);
}

type Tender = ReceiptDocument["tenders"][number];

export const tenderLabel = { cash: "Cash", card: "Card", momo: "MoMo" } as const;

export const tenderDetail = (tender: Tender) =>
  tender.approvalCode ?? tender.reference ?? tender.phone;

/** Tax rows in print order; the COVID levy appears only when charged. */
export function taxRows({ net, nhil, getfund, covid, vat }: ReceiptDocument["taxSummary"]) {
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
