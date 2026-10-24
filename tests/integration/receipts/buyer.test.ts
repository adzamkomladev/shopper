// Receipt `buyer: {name, tin} | null` (v3 on): both renderers print the same block, and `fiscalPayload` is the pure seam Day 20 submits.
//   fiscalPayload(receipt) -> { type, invoiceNumber, originalInvoiceNumber, issuedAt, seller: {name, tin}, buyer: {name, tin} | null,
//     lines: [{name, quantityThousandths, unitPrice, taxClass, gross, net}], totals: {net, nhil, getfund, covid, vat, total} }
import { expect, test } from "vite-plus/test";
import * as v from "valibot";
import { fiscalPayload } from "@shopper/core/receipts";
import { receiptDocument } from "@shopper/core/schemas";
import { encodeReceipt, printerProfiles } from "@shopper/hardware";
import { receiptHtml } from "@shopper/hardware/render";
import { decodeEscPos } from "../../support/hardware/escpos";
import { goldenReceipt, goldenRefundReceipt } from "../../support/hardware/receipt";

const buyer = { name: "Kofi Traders Ltd", tin: "C0012345678" };
const options = { paperMm: 80 as const, reprint: false };
const invoice = () => v.parse(receiptDocument, { ...goldenReceipt(), buyer });

/** The buyer's lines in print order, from each renderer. */
const thermal = (doc: ReturnType<typeof invoice>) =>
  decodeEscPos(
    encodeReceipt(doc, { profile: printerProfiles.epson, ...options, openDrawer: false }),
  ).text.map((line) => line.trim());
const html = (doc: ReturnType<typeof invoice>) => receiptHtml(doc, options);

function inOrder(haystack: string, parts: string[]) {
  let at = -1;
  for (const part of parts) {
    at = haystack.indexOf(part, at + 1);
    expect(at, `"${part}" in order`).toBeGreaterThan(-1);
  }
}

test("ESC/POS and the HTML view both print the Buyer, its name and its TIN, in that order", () => {
  const parts = ["Buyer", "Kofi Traders Ltd", "TIN C0012345678"];
  const lines = thermal(invoice());
  for (const part of parts) expect(lines.some((line) => line.includes(part))).toBe(true);
  inOrder(lines.join("\n"), parts);
  inOrder(html(invoice()), parts);
  // The seller's TIN line is still the header's own.
  expect(lines).toContain("TIN P0012345678");
  expect(html(invoice())).toContain("TIN P0012345678");
});

test("a receipt with no buyer prints no Buyer block in either renderer", () => {
  const doc = v.parse(receiptDocument, { ...goldenReceipt(), buyer: null });
  expect(thermal(doc).join("\n")).not.toContain("Buyer");
  expect(html(doc)).not.toContain("Buyer");
});

test("a buyer's name cannot inject printer commands", () => {
  const doc = v.parse(receiptDocument, {
    ...goldenReceipt(),
    buyer: { ...buyer, name: "Kofi\x1bp\x00\x19\xfa" },
  });
  const { commands } = decodeEscPos(
    encodeReceipt(doc, { profile: printerProfiles.epson, ...options, openDrawer: false }),
  );
  expect(commands.some((command) => command.name === "drawer")).toBe(false);
});

test("the fiscal payload is the seller, the buyer, the lines and the totals of the receipt", () => {
  const doc = invoice();
  const payload = fiscalPayload(doc);
  expect(payload).toMatchObject({
    type: "invoice",
    invoiceNumber: doc.header.receiptNumber,
    originalInvoiceNumber: null,
    issuedAt: doc.header.utcTime,
    seller: { name: doc.header.org, tin: doc.header.tin },
    buyer: { name: "Kofi Traders Ltd", tin: "C0012345678" },
    totals: {
      net: doc.taxSummary.net,
      nhil: doc.taxSummary.nhil,
      getfund: doc.taxSummary.getfund,
      covid: doc.taxSummary.covid,
      vat: doc.taxSummary.vat,
      total: doc.total,
    },
  });
  expect(payload.lines).toEqual(
    doc.lines.map((line) => ({
      name: line.name,
      quantityThousandths: line.quantityThousandths,
      unitPrice: line.unitPrice,
      taxClass: line.taxClass,
      gross: line.gross,
      net: line.net,
    })),
  );
  expect(fiscalPayload({ ...doc, buyer: null }).buyer).toBeNull();
  expect(fiscalPayload(doc)).toEqual(fiscalPayload(doc));
});

test("a long buyer name stays whole in the document and the fiscal payload, and both renderers cut it alike", () => {
  const long = "Kofi Traders and Sons Wholesale Distribution Limited";
  const customer = {
    id: "019a0000-0000-7000-8000-0000000000c1",
    name: "Kofi",
    phone: "0241234599",
    kind: "business",
    businessName: long,
    tin: buyer.tin,
  };
  const doc = goldenRefundReceipt({ kind: "cash" }, customer);
  expect(doc.buyer!.name).toBe(long);
  expect(fiscalPayload(doc).buyer!.name).toBe(long);
  const cut = long.slice(0, 48);
  expect(thermal(doc)).toContain(cut);
  expect(html(doc)).toContain(cut);
  expect(html(doc)).not.toContain(long);
  expect(thermal(doc).join("\n")).not.toContain(long);
});
