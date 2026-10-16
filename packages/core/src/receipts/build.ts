import { add, money } from "@shopper/money";
import type { SaleSnapshot } from "../schemas/till/sale";
import type { ReceiptDocument } from "../schemas/receipts/document";
import type { ReceiptReference } from "./types";

export function buildReceipt(
  sale: SaleSnapshot,
  reference: ReceiptReference = {},
): ReceiptDocument {
  const discountTotal = sale.lines.reduce((total, line) => add(total, line.tax.discount), money(0));
  const baseFor = (taxClass: "zero-rated" | "exempt") =>
    sale.lines
      .filter((line) => line.tax.taxClass === taxClass)
      .reduce((total, line) => add(total, line.tax.base), money(0));
  const at = new Date(sale.deviceTime).valueOf() - sale.clockOffsetMs;
  const utcTime = new Date(at).toISOString();
  return {
    v: 1,
    saleId: sale.id,
    header: {
      org: reference.orgName ?? sale.orgId,
      tin: reference.tin ?? null,
      branch: reference.branchName ?? sale.branchId,
      address: reference.address ?? null,
      device: reference.deviceName ?? sale.deviceId,
      cashier: reference.cashierName ?? sale.cashierId,
      receiptNumber: sale.receiptNumber,
      utcTime,
      accraTime: accra.format(new Date(at)).replace(",", ""),
      timeZone: "Africa/Accra",
    },
    lines: sale.lines.map((line) => ({
      name: line.name,
      quantityThousandths: line.tax.quantityThousandths,
      unit: line.baseUnit,
      unitPrice: line.tax.unitPrice,
      discount: line.tax.discount,
      gross: line.tax.gross,
      taxClass: line.tax.taxClass,
    })),
    taxSummary: {
      net: sale.totals.base,
      nhil: sale.totals.nhil,
      getfund: sale.totals.getfund,
      covid: sale.totals.covid,
      vat: sale.totals.vat,
      zeroRatedBase: baseFor("zero-rated"),
      exemptBase: baseFor("exempt"),
    },
    subtotal: add(sale.totals.gross, discountTotal),
    discountTotal,
    gross: sale.totals.gross,
    cashRounding: sale.cashRounding,
    total: sale.total,
    paid: sale.paid,
    change: sale.change,
    tenders: sale.tenders.map((tender) => {
      const phone = reference.tenderPhones?.[tender.id];
      return {
        kind: tender.kind,
        amount: tender.amount,
        reference: tender.reference ?? null,
        approvalCode: tender.kind === "card" ? (tender.approvalCode ?? null) : null,
        last4: tender.kind === "card" ? (tender.last4 ?? null) : null,
        phone: tender.kind === "momo" && phone ? `******${phone.slice(-4)}` : null,
      };
    }),
    footer: reference.footer ?? "Thank you for shopping with us",
  };
}

const accra = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Africa/Accra",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
