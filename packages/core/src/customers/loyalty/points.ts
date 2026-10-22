import { mulRate, unitsOf, type Money } from "@shopper/money";

/** Whole points for `paid` at `rateBps` when one point is worth `pointValue`: the cedi cannot buy part of a point. */
export const pointsEarned = (paid: Money, rateBps: number, pointValue: Money) =>
  unitsOf(mulRate(paid, rateBps), pointValue);

/**
 * The points a refund of `gross` takes back from an earn made at `rateBps` and `pointValue`, never more than
 * `unreversed`, which is what the sale earned and refunds have not yet taken back.
 */
export const pointsReversed = (
  gross: Money,
  earn: { rateBps: number; pointValue: Money },
  unreversed: number,
) => Math.min(unreversed, pointsEarned(gross, earn.rateBps, earn.pointValue));
