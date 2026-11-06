import { and, eq } from "drizzle-orm";
import {
  branch,
  org,
  type onlineOrder,
  type onlineOrderLine,
  type orderPayment,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import { buildReceipt } from "../receipts/build";
import type { SaleSnapshot } from "../schemas/till/sale";

type Order = typeof onlineOrder.$inferSelect;
type Line = typeof onlineOrderLine.$inferSelect;
type Payment = typeof orderPayment.$inferSelect;
type Tax = SaleSnapshot["lines"][number]["tax"];
type Payload = {
  name: string;
  sku?: string;
  baseUnit?: SaleSnapshot["lines"][number]["baseUnit"];
  tax: Tax;
};

/** The invoice number of an online order: the branch's code, a W for web, and the store's order number. */
export const orderReceiptNumber = (branchCode: string, number: bigint) =>
  `${branchCode || "BR"}-W-${String(number).padStart(6, "0")}`;

/**
 * The receipt an online order is paid with. It reads like any sale receipt, so the printed/emailed copy and the
 * fiscal payload come from the same builders; the "register" is the online store and the paying tender is the
 * payment that settled it (a card or mobile money).
 */
export async function buildOrderReceipt(
  tx: ShopperTransaction,
  order: Order,
  lines: Line[],
  payment: Payment,
  paidAt: Date,
  appVersion: string,
) {
  const [names] = await tx
    .select({ orgName: org.name, tin: org.tin, branchName: branch.name, branchCode: branch.code })
    .from(org)
    .innerJoin(branch, and(eq(branch.orgId, org.id), eq(branch.id, order.branchId)))
    .where(eq(org.id, order.orgId));
  const number = orderReceiptNumber(names!.branchCode, order.inboxCursor);
  const sold = {
    id: order.id,
    localId: order.id,
    orgId: order.orgId,
    deviceId: "online",
    storeId: order.storeId,
    branchId: order.branchId,
    cashierId: "online",
    sessionId: "online",
    appVersion,
    deviceTime: paidAt.toISOString(),
    clockOffsetMs: 0,
    lines: lines.map((line) => {
      const payload = line.payload as Payload;
      return {
        id: line.id,
        productId: line.productId ?? "",
        priceId: line.priceId ?? "",
        sku: payload.sku ?? "",
        name: payload.name,
        baseUnit: payload.baseUnit ?? "each",
        tax: payload.tax,
        discount: money(0),
        override: null,
        label: null,
      };
    }),
    totals: {
      base: order.base,
      vat: order.vat,
      nhil: order.nhil,
      getfund: order.getfund,
      covid: order.covid,
      gross: order.gross,
      roundingAdjustment: money(0),
    },
    receiptNumber: number,
    receiptOverflow: false,
    cashRounding: money(0),
    total: order.gross,
    paid: order.gross,
    change: money(0),
    tenders: [
      {
        id: payment.id,
        kind: payment.method === "card" ? ("card" as const) : ("momo" as const),
        amount: order.gross,
        reference: payment.id,
      },
    ],
  };
  const receipt = buildReceipt(sold, {
    orgName: names!.orgName,
    tin: names!.tin,
    branchName: names!.branchName,
    deviceName: "Online store",
    cashierName: "Online order",
    tenderPhones: { [payment.id]: payment.phone },
  });
  return { number, receipt };
}
