import { expect, test } from "vite-plus/test";
import * as v from "valibot";
import { receiptDocument } from "@shopper/core/schemas";
import { goldenReceipt } from "../../support/hardware/receipt";

test("a stored v1 receipt parses as a v2 sale receipt", () => {
  const { v: _v, kind: _kind, refundOf: _refundOf, ...rest } = goldenReceipt();
  const parsed = v.parse(receiptDocument, { v: 1, ...rest });
  expect(parsed).toEqual(goldenReceipt());
  expect(parsed).toMatchObject({ v: 2, kind: "sale", refundOf: null });
});

test("a v2 receipt is untouched and an unknown version is refused", () => {
  expect(v.parse(receiptDocument, goldenReceipt())).toEqual(goldenReceipt());
  expect(v.safeParse(receiptDocument, { ...goldenReceipt(), v: 3 }).success).toBe(false);
});
