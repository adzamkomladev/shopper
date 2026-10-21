import { add, money, sub, type Money } from "@shopper/money";
import type { RefundSnapshot } from "../schemas/till/refund";
import type { SaleSnapshot } from "../schemas/till/sale";

const TENDERS = ["cash", "card", "momo"] as const;
type Tender = (typeof TENDERS)[number];

type Parts = {
  float: Money;
  sales: readonly Pick<SaleSnapshot, "total" | "totals" | "change" | "tenders">[];
  refunds: readonly Pick<RefundSnapshot, "total" | "tender">[];
  drops: readonly Money[];
};

/**
 * What a shift's drawer and terminals should hold. Cash kept from a sale is its cash tenders less change (cash
 * rounding is already inside the change); a cash refund pays out its total (its rounding is inside the total).
 * The till's X and Z come from here. The server re-derives the same rules from the Z's own figures in
 * `validate.ts`; change both together, or every uploaded Z becomes SHIFT_MISMATCH.
 */
export function shiftTotals({ float, sales, refunds, drops }: Parts) {
  const sum = (amounts: readonly Money[]) => amounts.reduce(add, money(0));
  const taken = (kind: Tender) =>
    sum(
      sales.map((sale) => {
        const paid = sum(sale.tenders.filter((t) => t.kind === kind).map((t) => t.amount));
        return kind === "cash" ? sub(paid, sale.change) : paid;
      }),
    );
  const repaid = (kind: Tender) =>
    sum(refunds.filter((r) => r.tender.kind === kind).map((r) => r.total));
  const dropped = sum(drops);
  const tenders = TENDERS.map((tender) => {
    const lines = { sales: taken(tender), refunds: repaid(tender) };
    const net = sub(lines.sales, lines.refunds);
    // The drawer also holds the float and has lost its drops; a no-sale moves nothing.
    return { tender, ...lines, expected: tender === "cash" ? sub(add(float, net), dropped) : net };
  });
  const cash = tenders[0]!;
  return {
    sales: {
      count: sales.length,
      gross: sum(sales.map((s) => s.total)),
      tax: sum(
        sales.map((s) => sum([s.totals.vat, s.totals.nhil, s.totals.getfund, s.totals.covid])),
      ),
    },
    refunds: { count: refunds.length, total: sum(refunds.map((r) => r.total)) },
    tenders,
    cash: {
      float,
      sales: cash.sales,
      refunds: cash.refunds,
      drops: dropped,
      expected: cash.expected,
    },
  };
}
