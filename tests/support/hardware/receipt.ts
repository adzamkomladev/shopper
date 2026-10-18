import { buildReceipt, receiptDocument } from "@shopper/core/receipts";
import { snapshotLine } from "@shopper/tax";
import { add, money } from "@shopper/money";
import * as v from "valibot";
import { ids, references } from "../../fixtures/sales/golden";

export const saleLines = ["Fresh milk", "Brown bread"];

/** A cash + card split with change, priced under the prior (NHIL/GETFund) rule so every tax row is non-zero. */
export function goldenReceipt(lineNames = saleLines) {
  const rule = references.taxRules[0];
  if (!rule) throw new Error("Prior tax rule fixture missing");
  const lines = lineNames.map((name) => ({
    id: ids.product,
    productId: ids.product,
    priceId: ids.basePrice,
    sku: "TEST",
    name,
    baseUnit: "each" as const,
    discount: money(0),
    label: null,
    override: null,
    tax: snapshotLine({
      rule,
      on: "2025-06-15",
      taxClass: "standard",
      priceMode: "inclusive",
      unitPrice: money(25000),
      quantityThousandths: 1000,
      discount: money(0),
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
    deviceTime: "2025-06-15T10:30:00.000Z",
    clockOffsetMs: 0,
    receiptNumber: "BR1-T1-000001",
    receiptOverflow: false,
    lines,
    totals,
    cashRounding: money(0),
    total: money(50000),
    paid: money(60000),
    change: money(10000),
    tenders: [
      { id: ids.product, kind: "cash" as const, amount: money(40000) },
      {
        id: ids.basePrice,
        kind: "card" as const,
        amount: money(20000),
        approvalCode: "ABC123",
        last4: "1234",
      },
    ],
  };
  const receipt = buildReceipt(sale, {
    orgName: "Market",
    tin: "P0012345678",
    branchName: "Accra Central",
    address: "High Street",
    deviceName: "Till 1",
    cashierName: "Ama",
    footer: "Thank you",
  });
  return v.parse(receiptDocument, receipt);
}
