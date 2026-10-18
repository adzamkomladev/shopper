import { expect, test } from "vite-plus/test";
import * as v from "valibot";
import { buildReceipt, receiptDocument } from "@shopper/core/receipts";
import { snapshotLine } from "@shopper/tax";
import { add, money } from "@shopper/money";
import { ids, references } from "../../fixtures/sales/golden";

test("receipt preserves sale snapshots, tax classes and masked tender details", () => {
  const rule = references.taxRules[1];
  if (!rule) throw new Error("Current tax rule fixture missing");
  const lines = (["standard", "zero-rated", "exempt"] as const).map((taxClass) => ({
    id: ids.product,
    productId: ids.product,
    priceId: ids.basePrice,
    sku: "TEST",
    name: taxClass,
    baseUnit: "each" as const,
    discount: money(100),
    label: null,
    override: null,
    tax: snapshotLine({
      rule,
      on: "2026-10-15",
      taxClass,
      priceMode: "inclusive",
      unitPrice: money(10000),
      quantityThousandths: 1000,
      discount: money(100),
    }),
  }));
  const totals = {
    base: money(0),
    vat: money(0),
    nhil: money(0),
    getfund: money(0),
    covid: money(0),
    gross: money(0),
    roundingAdjustment: money(0),
  };
  for (const line of lines)
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] = add(totals[key], line.tax[key]);
  const sale = {
    id: ids.product,
    localId: ids.product,
    orgId: ids.org,
    deviceId: ids.device,
    storeId: ids.store,
    branchId: ids.branch,
    cashierId: ids.cashier,
    sessionId: ids.session,
    appVersion: "test",
    deviceTime: "2026-10-15T23:59:00.000Z",
    clockOffsetMs: 0,
    receiptNumber: "BR1-T1-000001",
    receiptOverflow: false,
    lines,
    totals,
    cashRounding: money(300),
    total: money(30000),
    paid: money(40000),
    change: money(10000),
    tenders: [
      {
        id: ids.product,
        kind: "momo" as const,
        amount: money(10000),
        reference: "payment",
        network: "mtn" as const,
      },
      {
        id: ids.basePrice,
        kind: "card" as const,
        amount: money(30000),
        approvalCode: "ABC123",
        last4: "1234",
      },
    ],
  };
  const receipt = buildReceipt(sale, {
    orgName: "Market",
    tin: "P001",
    branchName: "Accra",
    address: "High Street",
    deviceName: "Till 1",
    cashierName: "Ama",
    footer: "Thank you",
    tenderPhones: { [ids.product]: "0241234567" },
  });
  expect(v.safeParse(receiptDocument, receipt).success).toBe(true);
  expect(receipt.header.org).toBe("Market");
  expect(receipt.header.accraTime).toBe("2026-10-15 23:59:00");
  expect(receipt.lines.map((line) => line.taxClass)).toEqual(["standard", "zero-rated", "exempt"]);
  expect(receipt.lines[0]?.discount).toBe(100);
  expect(receipt.taxSummary.zeroRatedBase).toBe(9900);
  expect(receipt.taxSummary.exemptBase).toBe(9900);
  expect(receipt.tenders[0]?.phone).toBe("******4567");
  expect(JSON.stringify(receipt)).not.toContain("0241234567");
  expect(receipt.tenders[1]?.last4).toBe("1234");
  expect(receipt.cashRounding).toBe(300);
  expect(receipt.change).toBe(10000);
  expect(buildReceipt(sale)).toEqual(buildReceipt(sale));
  expect(buildReceipt({ ...sale, clockOffsetMs: 60000 }).header.utcTime).toBe(
    "2026-10-15T23:58:00.000Z",
  );
});
