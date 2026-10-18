import { buildReceipt } from "@shopper/core/receipts";
import { money } from "@shopper/money";
import type { ReceiptDocument } from "../src/sale/types";
import { basket, id, items, today } from "./fixtures";

export function makeReceipt(): ReceiptDocument {
  return buildReceipt(makeSaleSnapshot(), {
    orgName: "Shopper Market",
    branchName: "Accra Central",
    deviceName: "Till 1",
    cashierName: "Ama Mensah",
    footer: "Thank you for shopping with us.",
  });
}

export function makeSaleSnapshot(): Parameters<typeof buildReceipt>[0] {
  const view = basket(items.slice(0, 4));
  const lines: Parameters<typeof buildReceipt>[0]["lines"] = view.quote.lines.flatMap(
    (line, index) => {
      if ("error" in line) return [];
      const source = view.draft?.lines[index];
      if (!source) return [];
      return [
        {
          id: id(String(20 + index)),
          productId: id(String(30 + index)),
          priceId: id(String(40 + index)),
          sku: line.sku,
          name: line.name,
          baseUnit: line.baseUnit as Parameters<
            typeof buildReceipt
          >[0]["lines"][number]["baseUnit"],
          tax: { ...line.tax, rule: { ...line.tax.rule, id: id("50") } },
          discount: line.tax.discount,
          label: source.label ?? null,
          override: null,
        },
      ];
    },
  );
  return {
    id: id("10482"),
    localId: id("10483"),
    orgId: id("2"),
    deviceId: id("3"),
    storeId: id("4"),
    branchId: id("5"),
    cashierId: id("6"),
    sessionId: id("7"),
    appVersion: "0.1.0",
    deviceTime: today,
    lines,
    totals: view.quote.totals,
    receiptNumber: "10482",
    receiptOverflow: false,
    clockOffsetMs: 0,
    cashRounding: money(0),
    total: money(1_265_000),
    paid: money(1_300_000),
    change: money(35_000),
    tenders: [{ id: id("8"), kind: "cash", amount: money(1_300_000) }],
  };
}
