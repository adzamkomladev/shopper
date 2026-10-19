import { add, roundCash, sub, type Money } from "@shopper/money";

/**
 * What a refund pays out. Cash refunds pay the difference of `roundCash` on the cumulative cash-refunded
 * gross, so a full refund returns exactly the rounded sale total; card and MoMo pay the exact gross.
 * `cashRounding` is signed: the payout minus the refunded gross.
 */
export function refundPayout(input: {
  kind: "cash" | "card" | "momo";
  priorCash: Money;
  gross: Money;
  rounding: "none" | "10p";
}) {
  const total =
    input.kind === "cash" && input.rounding === "10p"
      ? sub(roundCash(add(input.priorCash, input.gross), 1000), roundCash(input.priorCash, 1000))
      : input.gross;
  return { total, cashRounding: sub(total, input.gross) };
}
