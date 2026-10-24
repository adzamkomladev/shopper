// Receipt v4: a VAT-registered shop's sale prints as a VAT INVOICE with its TIN and tax rows; a shop that is not
// registered prints a plain RECEIPT with neither. An invoice to a VAT buyer shows each line's amount before tax.
import { expect, test } from "vite-plus/test";
import { encodeReceipt, printerProfiles } from "@shopper/hardware";
import { receiptHtml } from "@shopper/hardware/render";
import type { ReceiptDocument } from "@shopper/core/receipts";
import { decodeEscPos } from "../../support/hardware/escpos";
import { goldenReceipt } from "../../support/hardware/receipt";

const options = { paperMm: 80 as const, reprint: false };
const thermal = (doc: ReceiptDocument) =>
  decodeEscPos(
    encodeReceipt(doc, { profile: printerProfiles.epson, ...options, openDrawer: false }),
  )
    .text.map((line) => line.trim())
    .join("\n");

test("a registered shop's sale is a VAT invoice with its TIN, tax rows and each line's net", () => {
  const doc = goldenReceipt();
  expect(doc.header).toMatchObject({ vatInvoice: true, tin: "P0012345678" });
  expect(doc.lines.map((line) => line.net)).toEqual(doc.lines.map(() => expect.any(Number)));
  for (const text of [thermal(doc), receiptHtml(doc, options)]) {
    expect(text).toContain("VAT INVOICE");
    expect(text).toContain("TIN P0012345678");
    expect(text).toContain("NHIL");
    expect(text).not.toContain("Before tax");
  }
});

test("an invoice to a VAT buyer shows each line before tax", () => {
  const doc = { ...goldenReceipt(), buyer: { name: "Kofi Traders Ltd", tin: "C0012345678" } };
  const text = thermal(doc);
  expect(text.match(/Before tax/g)).toHaveLength(doc.lines.length);
  expect(receiptHtml(doc, options).match(/Before tax/g)).toHaveLength(doc.lines.length);
  // The amount before tax plus the line's tax is its gross: the receipt's net total is the lines' nets.
  expect(doc.lines.reduce((sum, line) => sum + line.net!, 0)).toBe(doc.taxSummary.net);
});

test("a shop that is not VAT-registered prints a plain receipt: no TIN and no tax rows", () => {
  const doc = goldenReceipt(undefined, false);
  expect(doc.header).toMatchObject({ vatInvoice: false, tin: null });
  expect(doc.taxSummary).toMatchObject({ vat: 0, nhil: 0, getfund: 0 });
  for (const text of [thermal(doc), receiptHtml(doc, options)]) {
    expect(text).toContain("RECEIPT");
    expect(text).not.toContain("VAT INVOICE");
    expect(text).not.toContain("TIN ");
    expect(text).not.toContain("NHIL");
  }
});
