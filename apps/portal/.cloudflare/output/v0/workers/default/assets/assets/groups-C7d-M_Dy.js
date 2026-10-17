function e(e, r) {
  let i = e.filter((e) => n(e.validFrom) <= r),
    a = e.filter((e) => n(e.validFrom) > r).sort((e, t) => n(e.validFrom) - n(t.validFrom)),
    o = new Map();
  for (let e of i) (!e.validTo || n(e.validTo) > r) && !o.has(e.branchId) && o.set(e.branchId, e);
  let s = o.get(null) ?? null,
    c = [...o.values()].filter((e) => e.branchId),
    l = [...o.values()].flatMap((e) => {
      if (!e.validTo) return [];
      let t = i.find(
        (t) => t.branchId === e.branchId && t !== e && (!t.validTo || n(t.validTo) > n(e.validTo)),
      );
      return t ? [t] : [];
    });
  return {
    current: s,
    overrides: c,
    returning: l,
    upcoming: a,
    history: i
      .filter((e) => o.get(e.branchId) !== e && !l.includes(e))
      .map((e) => ({ ...e, validTo: t(e, i) })),
  };
}
function t(e, t) {
  let r = [
    e.validTo,
    ...t
      .filter((t) => t.branchId === e.branchId && n(t.validFrom) > n(e.validFrom))
      .map((e) => e.validFrom),
  ].flatMap((e) => (e ? [n(e)] : []));
  return r.length ? new Date(Math.min(...r)).toISOString() : null;
}
var n = (e) => Date.parse(e),
  r = new Intl.DateTimeFormat(`en-GB`, { dateStyle: `medium`, timeZone: `UTC` }),
  i = new Intl.DateTimeFormat(`en-GB`, {
    dateStyle: `medium`,
    timeStyle: `short`,
    timeZone: `UTC`,
  }),
  a = (e) => r.format(new Date(e)),
  o = (e) => i.format(new Date(e));
export { o as n, e as r, a as t };
