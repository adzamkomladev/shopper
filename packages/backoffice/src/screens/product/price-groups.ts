import { SHOP_TIME_ZONE } from "../../lib/shop-time";
import type { PriceView } from "./queries";

/**
 * Splits a product's price versions at `now`. In force is the newest started version per scope
 * (org-wide, or one branch) that has not ended. Each version lands in exactly one group, so the
 * reason and the branch show once. `history` rows carry the end they really had: the earlier of
 * their own end and the start of the newer version that replaced them.
 */
export function groupPrices(prices: PriceView[], now: number) {
  const started = prices.filter((price) => time(price.validFrom) <= now);
  const upcoming = prices
    .filter((price) => time(price.validFrom) > now)
    .sort((a, b) => time(a.validFrom) - time(b.validFrom));
  const inForce = new Map<string | null, PriceView>();
  // The API sends newest start first, so the first version seen per scope is the newest.
  for (const price of started)
    if ((!price.validTo || time(price.validTo) > now) && !inForce.has(price.branchId))
      inForce.set(price.branchId, price);
  const current = inForce.get(null) ?? null;
  const overrides = [...inForce.values()].filter((price) => price.branchId);
  // While a window runs, the newest started version that outlasts it applies again afterwards.
  const returning = [...inForce.values()].flatMap((active) => {
    if (!active.validTo) return [];
    const back = started.find(
      (price) =>
        price.branchId === active.branchId &&
        price !== active &&
        (!price.validTo || time(price.validTo) > time(active.validTo!)),
    );
    return back ? [back] : [];
  });
  const history = started
    .filter((price) => inForce.get(price.branchId) !== price && !returning.includes(price))
    .map((price) => ({ ...price, validTo: endOf(price, started) }));
  return { current, overrides, returning, upcoming, history };
}

function endOf(price: PriceView, started: PriceView[]) {
  const ends = [
    price.validTo,
    ...started
      .filter(
        (other) =>
          other.branchId === price.branchId && time(other.validFrom) > time(price.validFrom),
      )
      .map((other) => other.validFrom),
  ].flatMap((end) => (end ? [time(end)] : []));
  return ends.length ? new Date(Math.min(...ends)).toISOString() : null;
}

const time = (iso: string) => Date.parse(iso);

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: SHOP_TIME_ZONE });
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: SHOP_TIME_ZONE,
});

export const formatDate = (iso: string) => DATE.format(new Date(iso));
export const formatDateTime = (iso: string) => DATE_TIME.format(new Date(iso));
