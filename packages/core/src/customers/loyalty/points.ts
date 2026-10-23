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

const DAY = 86_400_000;
type PointsEntry = {
  id: string;
  reason: string;
  points: number;
  occurredAt: Date;
  lotId: string | null;
};

/**
 * Each earn lot, oldest first, with what is left of it: spending (every entry but earns and expiries, net) takes the
 * oldest lots first, and an expiry takes from its own lot. Points that came in other ways never expire.
 */
export function pointLots(entries: readonly PointsEntry[]) {
  const expired = new Map<string, number>();
  let spent = 0;
  for (const entry of entries) {
    if (entry.reason === "expire" && entry.lotId)
      expired.set(entry.lotId, (expired.get(entry.lotId) ?? 0) - entry.points);
    else if (entry.reason !== "earn" && entry.reason !== "expire") spent -= entry.points;
  }
  spent = Math.max(0, spent);
  return entries
    .filter((entry) => entry.reason === "earn")
    .sort((a, b) => a.occurredAt.valueOf() - b.occurredAt.valueOf() || a.id.localeCompare(b.id))
    .map((lot) => {
      const capacity = lot.points - (expired.get(lot.id) ?? 0);
      const used = Math.min(capacity, spent);
      spent -= used;
      return { id: lot.id, occurredAt: lot.occurredAt, left: capacity - used };
    });
}

/** When a lot lapses with `expiryDays` set (0 never calls this). */
export const lotExpiry = (lot: { occurredAt: Date }, expiryDays: number) =>
  new Date(lot.occurredAt.getTime() + expiryDays * DAY);
