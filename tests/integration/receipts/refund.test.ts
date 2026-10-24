import { expect, test } from "vite-plus/test";
import { toDecimal } from "@shopper/money";
import { encodeReceipt, printerProfiles } from "@shopper/hardware";
import { receiptHtml } from "@shopper/hardware/render";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { decodeEscPos } from "../../support/hardware/escpos";
import { goldenReceipt, goldenRefundReceipt } from "../../support/hardware/receipt";

const sale = goldenReceipt();
const options = { paperMm: 80 as const, reprint: false };

test("the document marks a sale as a sale and a refund as a numbered credit note for the original receipt", () => {
  expect(sale).toMatchObject({ v: 4, kind: "sale", refundOf: null });
  const refund = goldenRefundReceipt();
  expect(refund).toMatchObject({
    v: 4,
    kind: "refund",
    refundOf: "BR1-T1-000001",
    header: { receiptNumber: "BR1-T1-000002" },
    paid: 0,
    change: 0,
    tenders: [{ kind: "cash" }],
  });
  expect(refund.lines).toHaveLength(1);
  expect(refund.total).toBe(refund.gross);
});

test("a refund of a sale to a VAT buyer carries the buyer, and a refund of a walk-in sale does not", () => {
  const customer = {
    id: "019a0000-0000-7000-8000-0000000000c1",
    name: "Kofi Mensah",
    phone: "0241234599",
    kind: "business" as const,
    businessName: "Kofi Traders Ltd",
    tin: "C0012345678",
  };
  const refund = goldenRefundReceipt({ kind: "cash" }, customer);
  expect(refund).toMatchObject({
    kind: "refund",
    buyer: { name: "Kofi Traders Ltd", tin: "C0012345678" },
  });
  expect(receiptHtml(refund, options)).toContain("TIN C0012345678");
  expect(goldenRefundReceipt()).toMatchObject({ buyer: null });
  expect(goldenRefundReceipt({ kind: "cash" }, { ...customer, tin: null })).toMatchObject({
    buyer: null,
  });
});

test("the HTML shows CREDIT NOTE, the original receipt and the payout in place of paid and change", () => {
  const html = receiptHtml(goldenRefundReceipt({ kind: "card", reference: "CARD-77" }), options);
  expect(html).toContain("CREDIT NOTE");
  expect(html).toContain("Credit note for BR1-T1-000001");
  expect(html).toContain("Refunded (Card CARD-77)");
  expect(html).not.toContain("Change");
  const cash = receiptHtml(goldenRefundReceipt(), options);
  expect(cash).toContain("Refunded (Cash)");
  expect(receiptHtml(sale, options)).not.toContain("CREDIT NOTE");
});

test("the ESC/POS receipt prints CREDIT NOTE, the original receipt and the payout line", () => {
  const refund = goldenRefundReceipt({ kind: "momo", reference: "MOMO-12" });
  const bytes = encodeReceipt(refund, {
    profile: printerProfiles.epson,
    paperMm: 80,
    reprint: false,
    openDrawer: false,
  });
  const { text } = decodeEscPos(bytes);
  expect(text).toContain("CREDIT NOTE");
  expect(text).toContain("Credit note for BR1-T1-000001");
  expect(text.some((line) => line.startsWith("Refunded (MoMo MOMO-12)"))).toBe(true);
  expect(text.some((line) => line.endsWith(`GHS ${toDecimal(refund.total)}`))).toBe(true);
  expect(text.some((line) => line.startsWith("Change"))).toBe(false);
});

test("the PNG renders at the paper width and differs from the sale receipt", async () => {
  const renderer = boxRenderer();
  const refund = await renderer.receipt(goldenRefundReceipt(), options, "png");
  const original = await renderer.receipt(sale, options, "png");
  expect([...refund.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(new DataView(refund.buffer, refund.byteOffset).getUint32(16)).toBe(576);
  expect(Buffer.from(refund).equals(Buffer.from(original))).toBe(false);
});
