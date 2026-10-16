import { v7 } from "uuid";
import { saleEvent } from "@shopper/core/schemas";
import * as v from "valibot";
import { goldenSale } from "../../../fixtures/sales/golden";

export async function createSaleEvent(appVersion: string, orgId: string, storeId: string) {
  const ids = {
    localId: v7(),
    lineId: v7(),
    branchId: v7(),
    deviceId: v7(),
    cashierId: v7(),
    sessionId: v7(),
    productId: v7(),
    priceId: v7(),
    taxRuleId: v7(),
    otherStoreId: v7(),
    otherDeviceId: v7(),
  };
  const deviceTime = "2025-12-31T23:30:00.000Z";
  const event = v.parse(saleEvent, {
    v: 3,
    type: "sale.recorded",
    sale: {
      id: ids.localId,
      localId: ids.localId,
      orgId,
      deviceId: ids.deviceId,
      storeId,
      branchId: ids.branchId,
      cashierId: ids.cashierId,
      sessionId: ids.sessionId,
      appVersion,
      deviceTime,
      receiptNumber: null,
      receiptOverflow: false,
      clockOffsetMs: 0,
      lines: [
        {
          id: ids.lineId,
          productId: ids.productId,
          priceId: ids.priceId,
          sku: `CONF-${ids.productId}`,
          name: "Conformance product",
          baseUnit: "each",
          discount: 0,
          label: null,
          tax: {
            on: goldenSale.on,
            taxClass: "standard",
            priceMode: "inclusive",
            quantityThousandths: goldenSale.quantityThousandths,
            unitPrice: goldenSale.unitPrice,
            discount: 0,
            ...goldenSale.line,
            rule: {
              id: ids.taxRuleId,
              effectiveFrom: "2025-01-01",
              vatBps: 1_500,
              nhilBps: 250,
              getfundBps: 250,
              covidBps: 0,
            },
          },
        },
      ],
      totals: goldenSale.totals,
      cashRounding: 0,
      total: goldenSale.totals.gross,
      paid: goldenSale.totals.gross,
      change: 0,
      tenders: [{ id: v7(), kind: "cash", amount: goldenSale.totals.gross }],
    },
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(event.sale)),
  );
  const contentHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    ...ids,
    orgId,
    storeId,
    appVersion,
    deviceTime,
    payload: event.sale,
    line: event.sale.lines[0],
    contentHash,
  };
}

export type PendingSaleSnapshot = Awaited<ReturnType<typeof createSaleEvent>>;
