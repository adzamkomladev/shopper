import { expect, test } from "vite-plus/test";
import * as v from "valibot";
import { receiptDocument } from "@shopper/core/schemas";
import { goldenReceipt } from "../../support/hardware/receipt";

/** A pre-v4 receipt is the v4 one a registered shop issued, without the nets it never recorded. */
const withoutNets = () => {
  const receipt = goldenReceipt();
  return { ...receipt, lines: receipt.lines.map((line) => ({ ...line, net: null })) };
};
const v3 = () => {
  const { v: _v, header, lines, fiscal: _fiscal, ...rest } = goldenReceipt();
  const { vatInvoice: _vatInvoice, ...v3Header } = header;
  return { ...rest, header: v3Header, lines: lines.map(({ net: _net, ...line }) => line) };
};

test("a stored v1 receipt parses as a v5 sale receipt with no buyer", () => {
  const { kind: _kind, refundOf: _refundOf, buyer: _buyer, ...rest } = v3();
  const parsed = v.parse(receiptDocument, { v: 1, ...rest });
  expect(parsed).toEqual(withoutNets());
  expect(parsed).toMatchObject({ v: 5, kind: "sale", refundOf: null, buyer: null });
});

test("a v3 receipt reads as a registered shop's VAT invoice; a v4 one as unsigned; v5 is untouched; an unknown version is refused", () => {
  expect(v.parse(receiptDocument, { v: 3, ...v3() })).toEqual(withoutNets());
  const { fiscal: _fiscal, ...v4 } = goldenReceipt();
  expect(v.parse(receiptDocument, { ...v4, v: 4 })).toEqual(goldenReceipt());
  expect(v.parse(receiptDocument, goldenReceipt())).toEqual(goldenReceipt());
  expect(v.safeParse(receiptDocument, { ...goldenReceipt(), v: 6 }).success).toBe(false);
});
