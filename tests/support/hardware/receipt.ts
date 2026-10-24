import { v7 } from "uuid";
import { buildReceipt, buildRefundReceipt, receiptDocument } from "@shopper/core/receipts";
import { refundSnapshot } from "@shopper/core/schemas";
import { snapshotLine, refundShare } from "@shopper/tax";
import { add, money } from "@shopper/money";
import * as v from "valibot";
import { ids, references } from "../../fixtures/sales/golden";

export const saleLines = ["Fresh milk", "Brown bread"];

const reference = {
  orgName: "Market",
  tin: "P0012345678",
  branchName: "Accra Central",
  address: "High Street",
  deviceName: "Till 1",
  cashierName: "Ama",
  footer: "Thank you",
};

/** A cash + card split with change, priced under the prior (NHIL/GETFund) rule so every tax row is non-zero. */
export function goldenReceipt(lineNames = saleLines, registered = true) {
  return v.parse(receiptDocument, buildReceipt(goldenSale(lineNames, registered), reference));
}

/** The refund receipt of one unit of the golden sale's first line, paid back as `tender`. */
export function goldenRefundReceipt(
  tender: { kind: "cash" } | { kind: "card" | "momo"; reference: string } = { kind: "cash" },
  customer: Parameters<typeof buildRefundReceipt>[1]["customer"] = null,
) {
  const sale = goldenSale();
  const original = sale.lines[0]!;
  const tax = refundShare(original.tax, 0, 1000);
  const refund = v.parse(refundSnapshot, {
    id: v7(),
    orgId: sale.orgId,
    deviceId: sale.deviceId,
    storeId: sale.storeId,
    branchId: sale.branchId,
    cashierId: sale.cashierId,
    sessionId: sale.sessionId,
    appVersion: "test",
    deviceTime: "2025-06-16T09:00:00.000Z",
    clockOffsetMs: 0,
    originalSaleId: sale.id,
    creditNoteNumber: "BR1-T1-000002",
    reason: "Customer returned goods",
    approverId: null,
    lines: [
      {
        id: v7(),
        originalLineId: original.id,
        productId: original.productId,
        name: original.name,
        baseUnit: "each",
        tax,
      },
    ],
    totals: {
      base: tax.base,
      vat: tax.vat,
      nhil: tax.nhil,
      getfund: tax.getfund,
      covid: tax.covid,
      gross: tax.gross,
      roundingAdjustment: tax.roundingAdjustment,
    },
    cashRounding: 0,
    total: tax.gross,
    accountCredit: 0,
    pointsReturned: 0,
    pointsValue: 0,
    tender,
  });
  return v.parse(
    receiptDocument,
    buildRefundReceipt(refund, { receiptNumber: sale.receiptNumber, customer }, reference),
  );
}

function goldenSale(lineNames = saleLines, registered = true) {
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
      registered,
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
  return sale;
}
