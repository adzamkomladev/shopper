import { add, money } from "@shopper/money";
import type { RefundSnapshot } from "../schemas/till/refund";
import type { SaleSnapshot } from "../schemas/till/sale";
import type { ReceiptDocument } from "../schemas/receipts/document";
import type { ReceiptReference } from "./types";

type Lines = SaleSnapshot["lines"] | RefundSnapshot["lines"];
type Totals = SaleSnapshot["totals"];
/** A sale as the receipt reads it; a walk-in has no customer to name. */
type Sold = Omit<SaleSnapshot, "customer"> & Partial<Pick<SaleSnapshot, "customer">>;

export function buildReceipt(sale: Sold, reference: ReceiptReference = {}): ReceiptDocument {
  return {
    ...common(sale, sale.lines, sale.totals, sale.receiptNumber, reference),
    kind: "sale",
    refundOf: null,
    buyer: buyerOf(sale.customer),
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
  };
}

/** What was paid back for a refund: the returned lines with their share of the sold tax, and the payout as the one tender. */
export function buildRefundReceipt(
  refund: RefundSnapshot,
  original: { receiptNumber: string | null; customer?: SaleSnapshot["customer"] },
  reference: ReceiptReference = {},
): ReceiptDocument {
  const { tender } = refund;
  return {
    ...common(refund, refund.lines, refund.totals, refund.creditNoteNumber, reference),
    kind: "refund",
    refundOf: original.receiptNumber,
    // A credit note to a VAT buyer needs the buyer's TIN too.
    buyer: buyerOf(original.customer),
    // The sale's id ties the receipt to the sale it returns.
    saleId: refund.originalSaleId,
    cashRounding: refund.cashRounding,
    total: refund.total,
    paid: money(0),
    change: money(0),
    tenders: [
      {
        kind: tender.kind,
        amount: refund.total,
        reference: "reference" in tender ? tender.reference : null,
        approvalCode: null,
        last4: null,
        phone: null,
      },
    ],
  };
}

/** The invoice's buyer: a customer with a TIN, under its full business name when it has one. */
const buyerOf = (customer: SaleSnapshot["customer"] | undefined) =>
  customer?.tin ? { name: customer.businessName ?? customer.name, tin: customer.tin } : null;

/** The header, lines, tax summary and totals that a sale and a refund receipt share. */
function common(
  source: {
    id: string;
    orgId: string;
    deviceId: string;
    branchId: string;
    cashierId: string;
    deviceTime: string;
    clockOffsetMs: number;
  },
  lines: Lines,
  totals: Totals,
  receiptNumber: string | null,
  reference: ReceiptReference,
) {
  const discountTotal = lines.reduce((total, line) => add(total, line.tax.discount), money(0));
  const baseFor = (taxClass: "zero-rated" | "exempt") =>
    lines
      .filter((line) => line.tax.taxClass === taxClass)
      .reduce((total, line) => add(total, line.tax.base), money(0));
  const at = new Date(source.deviceTime).valueOf() - source.clockOffsetMs;
  // Every line of one sale is dated the same day, so they agree on whether the shop was registered.
  const vatInvoice = lines.every((line) => line.tax.registered);
  return {
    v: 5 as const,
    saleId: source.id,
    header: {
      org: reference.orgName ?? source.orgId,
      tin: vatInvoice ? (reference.tin ?? null) : null,
      branch: reference.branchName ?? source.branchId,
      address: reference.address ?? null,
      device: reference.deviceName ?? source.deviceId,
      cashier: reference.cashierName ?? source.cashierId,
      receiptNumber,
      utcTime: new Date(at).toISOString(),
      accraTime: accra.format(new Date(at)).replace(",", ""),
      timeZone: "Africa/Accra" as const,
      vatInvoice,
    },
    lines: lines.map((line) => ({
      name: line.name,
      quantityThousandths: line.tax.quantityThousandths,
      unit: line.baseUnit,
      unitPrice: line.tax.unitPrice,
      discount: line.tax.discount,
      gross: line.tax.gross,
      net: line.tax.base,
      taxClass: line.tax.taxClass,
    })),
    taxSummary: {
      net: totals.base,
      nhil: totals.nhil,
      getfund: totals.getfund,
      covid: totals.covid,
      vat: totals.vat,
      zeroRatedBase: baseFor("zero-rated"),
      exemptBase: baseFor("exempt"),
    },
    subtotal: add(totals.gross, discountTotal),
    discountTotal,
    gross: totals.gross,
    footer: reference.footer ?? "Thank you for shopping with us",
    // A VAT invoice is provisional until the SDC signs it; the signature is added when it arrives.
    fiscal: null,
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
