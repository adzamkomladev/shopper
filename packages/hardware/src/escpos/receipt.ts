import type { ReceiptDocument } from "@shopper/core/receipts";
import {
  clip,
  ghs,
  qrCaption,
  qrPayload,
  quantity,
  refundedLabel,
  taxRows,
  tenderDetail,
  tenderLabel,
} from "../format";
import { paper } from "../profiles";
import type { EncodeOptions } from "../types";
import { ascii, escpos } from "./encoder";

export function encodeReceipt(receipt: ReceiptDocument, options: EncodeOptions): Uint8Array {
  const { cols } = paper[options.paperMm];
  const printer = escpos(options.profile, options.paperMm);
  const fit = (value: string) => clip(ascii(value), cols);
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
  const refund = receipt.kind === "refund";

  printer.init();
  if (options.openDrawer) printer.drawer();
  printer.bold(true).size(2, 2);
  printer.align("center").text(ascii(header.org).slice(0, cols / 2));
  printer.size(1, 1).bold(false);
  if (header.tin) center(`TIN ${header.tin}`);
  center(header.branch);
  if (header.address) center(header.address);
  if (options.reprint) printer.bold(true).text("*** REPRINT ***").bold(false);
  if (refund) {
    printer.bold(true).size(2, 2).text("REFUND").size(1, 1).bold(false);
    center(`Refund of ${receipt.refundOf ?? "an earlier sale"}`);
  }
  printer.align("left");
  if (header.receiptNumber) printer.text(row("Receipt", header.receiptNumber));
  printer.text(row("Date", header.accraTime));
  printer.text(row("Cashier", header.cashier));
  if (receipt.buyer)
    printer
      .bold(true)
      .text("Buyer")
      .bold(false)
      .text(fit(receipt.buyer.name))
      .text(fit(`TIN ${receipt.buyer.tin}`));
  printer.text("-".repeat(cols));

  for (const line of receipt.lines) {
    printer.text(fit(line.name));
    printer.text(
      row(`  ${quantity(line.quantityThousandths)} x ${ghs(line.unitPrice)}`, ghs(line.gross)),
    );
  }
  printer.text("-".repeat(cols));

  for (const [label, amount] of taxRows(taxSummary)) printer.text(row(label, ghs(amount)));
  printer.text("-".repeat(cols));

  printer
    .bold(true)
    .text(row("TOTAL", ghs(receipt.total)))
    .bold(false);
  for (const tender of receipt.tenders) {
    if (refund) {
      printer.text(row(refundedLabel(tender), ghs(tender.amount)));
      continue;
    }
    printer.text(row(tenderLabel[tender.kind], ghs(tender.amount)));
    const detail = tenderDetail(tender);
    if (detail) printer.text(fit(`  ${detail}`));
  }
  if (!refund) printer.text(row("Change", ghs(receipt.change)));
  printer.feed(1);

  if (!refund) {
    printer.align("center").qr(qrPayload(receipt));
    center(qrCaption);
    printer.feed(1);
  }
  center(receipt.footer);
  return printer.cut().bytes();
}
