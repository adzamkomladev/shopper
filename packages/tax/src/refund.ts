import { add, mulRatio, sub, type Money } from "@shopper/money";
import type { TaxSnapshot } from "./types";

const parts = ["base", "vat", "nhil", "getfund", "covid", "gross", "discount"] as const;

/**
 * The tax of refunding sold quantity `before`..`after` of a line. Each component is the difference of
 * two cumulative pro-rata amounts of the SOLD snapshot, so shares are never negative and any number of
 * partial refunds sum exactly to the original line. Rule, date and rates are copied, never re-read.
 */
export function refundShare<T extends Omit<TaxSnapshot, "roundingAdjustment">>(
  original: T,
  before: number,
  after: number,
) {
  const sold = original.quantityThousandths;
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after) || before < 0 || after > sold)
    throw new RangeError("Refund quantities must lie within the sold quantity");
  if (before >= after) throw new RangeError("Refund must cover a positive quantity");
  const cumulative = (amount: Money, x: number) =>
    x === sold ? amount : mulRatio(amount, x, sold);
  const share = Object.fromEntries(
    parts.map((part) => [
      part,
      sub(cumulative(original[part], after), cumulative(original[part], before)),
    ]),
  ) as Record<(typeof parts)[number], Money>;
  return {
    ...share,
    rule: original.rule,
    on: original.on,
    taxClass: original.taxClass,
    priceMode: original.priceMode,
    registered: original.registered,
    unitPrice: original.unitPrice,
    quantityThousandths: after - before,
    roundingAdjustment: sub(
      share.gross,
      [share.vat, share.nhil, share.getfund, share.covid].reduce(add, share.base),
    ),
  };
}
