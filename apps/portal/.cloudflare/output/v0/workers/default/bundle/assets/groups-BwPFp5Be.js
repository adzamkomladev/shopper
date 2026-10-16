//#region ../../packages/backoffice/src/lib/catalogue/detail/prices/groups.ts
/**
 * Splits a product's price versions at `now`. In force is the newest started version per scope
 * (org-wide, or one branch) that has not ended. Each version lands in exactly one group, so the
 * reason and the branch show once. `history` rows carry the end they really had: the earlier of
 * their own end and the start of the newer version that replaced them.
 */
function groupPrices(prices, now) {
  const started = prices.filter((price) => time(price.validFrom) <= now);
  const upcoming = prices
    .filter((price) => time(price.validFrom) > now)
    .sort((a, b) => time(a.validFrom) - time(b.validFrom));
  const inForce = /* @__PURE__ */ new Map();
  for (const price of started)
    if ((!price.validTo || time(price.validTo) > now) && !inForce.has(price.branchId))
      inForce.set(price.branchId, price);
  const current = inForce.get(null) ?? null;
  const overrides = [...inForce.values()].filter((price) => price.branchId);
  const returning = [...inForce.values()].flatMap((active) => {
    if (!active.validTo) return [];
    const back = started.find(
      (price) =>
        price.branchId === active.branchId &&
        price !== active &&
        (!price.validTo || time(price.validTo) > time(active.validTo)),
    );
    return back ? [back] : [];
  });
  return {
    current,
    overrides,
    returning,
    upcoming,
    history: started
      .filter((price) => inForce.get(price.branchId) !== price && !returning.includes(price))
      .map((price) => ({
        ...price,
        validTo: endOf(price, started),
      })),
  };
}
function endOf(price, started) {
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
var time = (iso) => Date.parse(iso);
var DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});
var DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
var formatDate = (iso) => DATE.format(new Date(iso));
var formatDateTime = (iso) => DATE_TIME.format(new Date(iso));
//#endregion
export { formatDateTime as n, groupPrices as r, formatDate as t };
