import type { ReceiptDocument } from "@shopper/core/receipts";
import { toDecimal, type Money } from "@shopper/money";
import { paper } from "../profiles";
import type { EncodeOptions } from "../types";
import { ascii, escpos } from "./encoder";

const ghs = (amount: Money) => `GHS ${toDecimal(amount)}`;

export function encodeReceipt(receipt: ReceiptDocument, options: EncodeOptions): Uint8Array {
  const { cols } = paper[options.paperMm];
  const printer = escpos(options.profile, options.paperMm);
  const fit = (value: string) => ascii(value).slice(0, cols);
  const row = (left: string, right: string) => {
    const end = ascii(right).slice(0, cols - 2);
    return (
      ascii(left)
        .slice(0, cols - end.length - 1)
        .padEnd(cols - end.length) + end
    );
  };
  const center = (value: string) => printer.align("center").text(fit(value));
  const { header, taxSummary } = receipt;

  printer.init();
  if (options.openDrawer) printer.drawer();
  printer.bold(true).size(2, 2);
  printer.align("center").text(ascii(header.org).slice(0, cols / 2));
  printer.size(1, 1).bold(false);
  if (header.tin) center(`TIN ${header.tin}`);
  center(header.branch);
  if (header.address) center(header.address);
  if (options.reprint) printer.bold(true).text("*** REPRINT ***").bold(false);
  printer.align("left");
  if (header.receiptNumber) printer.text(row("Receipt", header.receiptNumber));
  printer.text(row("Date", header.accraTime));
  printer.text(row("Cashier", header.cashier));
  printer.text("-".repeat(cols));

  for (const line of receipt.lines) {
    printer.text(fit(line.name));
    printer.text(
      row(`  ${quantity(line.quantityThousandths)} x ${ghs(line.unitPrice)}`, ghs(line.gross)),
    );
  }
  printer.text("-".repeat(cols));

  printer.text(row("Net", ghs(taxSummary.net)));
  printer.text(row("NHIL", ghs(taxSummary.nhil)));
  printer.text(row("GETFund", ghs(taxSummary.getfund)));
  if (taxSummary.covid !== 0) printer.text(row("COVID", ghs(taxSummary.covid)));
  printer.text(row("VAT", ghs(taxSummary.vat)));
  printer.text("-".repeat(cols));

  printer
    .bold(true)
    .text(row("TOTAL", ghs(receipt.total)))
    .bold(false);
  for (const tender of receipt.tenders) {
    const label = { cash: "Cash", card: "Card", momo: "MoMo" }[tender.kind];
    printer.text(row(label, ghs(tender.amount)));
    const detail = tender.approvalCode ?? tender.reference ?? tender.phone;
    if (detail) printer.text(fit(`  ${detail}`));
  }
  printer.text(row("Change", ghs(receipt.change)));
  printer.feed(1);

  printer.align("center").qr(`${header.receiptNumber ?? ""}|${receipt.saleId}`);
  center("E-VAT QR pending");
  printer.feed(1);
  center(receipt.footer);
  return printer.cut().bytes();
}

/** Integer thousandths as a trimmed decimal: 1500 → "1.5", 2000 → "2". */
function quantity(thousandths: number) {
  const fraction = String(thousandths % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${Math.floor(thousandths / 1000)}.${fraction}` : String(thousandths / 1000);
}
