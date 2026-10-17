import {
  $ as e,
  A as t,
  B as n,
  D as r,
  H as i,
  I as a,
  J as o,
  K as s,
  L as c,
  M as l,
  N as u,
  O as d,
  Q as f,
  R as p,
  S as m,
  T as ee,
  U as h,
  V as te,
  W as g,
  X as _,
  Y as v,
  at as ne,
  b as y,
  j as b,
  k as re,
  n as ie,
  nt as ae,
  ot as oe,
  r as x,
  tt as S,
  x as se,
  y as C,
} from "./createLucideIcon-BBeoGZx-.js";
var w = (n) => g(e(), ae(), l(1), t(n)),
  T = w(200),
  ce = g(c(), v(), u(1), b(2147483647)),
  E = g(
    e(),
    o(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/),
    m((e) => {
      let [t, n, r] = e.slice(0, 10).split(`-`).map(Number);
      return n >= 1 && n <= 12 && r >= 1 && r <= new Date(Date.UTC(t, n, 0)).getUTCDate();
    }, `Invalid calendar date`),
    S((e) => new Date(e)),
    m((e) => !Number.isNaN(e.getTime()), `Invalid timestamp`),
  ),
  le = f({ code: w(64), quantityThousandths: n(ce, 1e3) }),
  D = {
    sku: w(64),
    name: T,
    baseUnit: h([`each`, `kg`, `g`, `l`, `ml`]),
    taxClass: h([`standard`, `zero-rated`, `exempt`]),
    categoryId: a(x),
    supplierId: a(x),
    onlineVisible: y(),
  },
  ue = f({
    ...D,
    categoryId: n(D.categoryId),
    supplierId: n(D.supplierId),
    onlineVisible: n(D.onlineVisible, !1),
    barcodes: n(C(le), []),
  }),
  de = i(f(D));
(p({
  q: n(w(100)),
  categoryId: n(x),
  cursor: n(x),
  limit: n(g(e(), S(Number), v(), u(1), b(200)), `50`),
}),
  f({ amount: g(c(), v(), u(1)), branchId: n(x), validFrom: n(E) }));
var fe = p({ branchId: n(x), at: n(E) });
p({ ...fe.entries, productId: x });
var O = n(a(g(e(), ae(), t(200)))),
  pe = f({ name: T, parentId: n(a(x)) }),
  me = f({ name: T, phone: O, email: O, tin: O });
(p({ orgId: x, priceId: x, actorId: n(x), startsAt: E, endsAt: E }),
  g(
    f({ amount: g(c(), v(), u(1)), branchId: n(x), startsAt: E, endsAt: E }),
    m((e) => e.endsAt > e.startsAt, `endsAt must be after startsAt`),
    m((e) => e.endsAt.getTime() > Date.now(), `endsAt must be in the future`),
  ),
  i(pe),
  i(me));
var k = e(),
  A = e(),
  j = g(c(), v()),
  M = g(c(), v()),
  he = p({ id: k, name: e() }),
  ge = p({ id: k, name: e(), storeId: k }),
  N = p({ id: k, branchId: a(k), amount: j, validFrom: A, validTo: a(A), reason: a(e()) }),
  P = {
    id: k,
    sku: e(),
    name: e(),
    baseUnit: h([`each`, `kg`, `g`, `l`, `ml`]),
    taxClass: h([`standard`, `zero-rated`, `exempt`]),
    categoryId: a(k),
    supplierId: a(k),
    onlineVisible: y(),
    archivedAt: a(A),
  },
  _e = p({ ...P, price: a(j) }),
  ve = p({ items: C(_e), nextCursor: a(k) }),
  ye = p({ ...P, barcodes: C(p({ code: e(), quantityThousandths: M })), prices: C(N) }),
  be = p({ id: k, name: e(), parentId: a(k), createdAt: A, updatedAt: A });
p({ id: k, name: e(), phone: a(e()), email: a(e()), tin: a(e()), createdAt: A, updatedAt: A });
var F = p({ row: M, column: e(), value: e(), message: e() }),
  I = { rowsTotal: M, rowsOk: M, rowsFailed: M, errors: C(F) },
  xe = p({ dryRun: d(!0), ...I, created: M, updated: M, unchanged: M, pricesAdded: M }),
  Se = p({ dryRun: d(!1), id: k, ...I, created: M, updated: M, unchanged: M, pricesAdded: M });
p({
  id: k,
  fileName: e(),
  rowsTotal: M,
  rowsOk: M,
  rowsFailed: M,
  report: p({ errors: C(F) }),
  priceValidFrom: A,
  createdAt: A,
});
var L = g(c(), v()),
  R = f({ start: g(L, u(2), b(11)), length: g(L, u(1), b(10)) }),
  z = { prefix: g(L, u(20), b(29)), product: R, value: R, decimals: g(L, u(0), b(4)) },
  B = (e) => e.start + e.length,
  V = (e) => B(e) <= 12,
  H = g(
    oe(`kind`, [
      f({ ...z, kind: d(`weight`), unit: h([`g`, `kg`]) }),
      f({ ...z, kind: d(`price`) }),
    ]),
    m((e) => V(e.product) && V(e.value), `Slices must end by digit 11`),
    m(
      (e) => B(e.product) <= e.value.start || B(e.value) <= e.product.start,
      `Product and value digits overlap`,
    ),
  );
i(f({ ...z, kind: h([`weight`, `price`]), unit: h([`g`, `kg`]) }));
var Ce = g(c(), v(), u(1)),
  we = f({ name: T, cashRoundingStep: n(Ce) });
f({ name: n(T), cashRoundingStep: n(Ce) });
var Te = f({ name: T, storeId: x });
f({ name: n(T), storeId: n(x) });
var Ee = g(c(), v()),
  De = g(Ee, se(`Money`));
function U(e) {
  return te(De, e);
}
function Oe(e) {
  if (e > BigInt(2 ** 53 - 1) || e < BigInt(-(2 ** 53 - 1)))
    throw RangeError(`Money exceeds the safe integer range`);
  return U(Number(e));
}
function ke(e, t) {
  if (t <= 0n) throw RangeError(`Denominator must be positive`);
  let n = ((e < 0n ? -e : e) + t / 2n) / t;
  return e < 0n ? -n : n;
}
var Ae = 1e4;
function je(e) {
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(e)) throw TypeError(`Expected a decimal with at most 4 places`);
  let t = e.startsWith(`-`),
    [n, r = ``] = (t ? e.slice(1) : e).split(`.`),
    i = BigInt(n) * BigInt(Ae) + BigInt(r.padEnd(4, `0`));
  return Oe(t ? -i : i);
}
function Me(e, t = 2) {
  if (t !== 2 && t !== 4) throw RangeError(`Supported precision: 2 or 4`);
  let n = ke(BigInt(U(e)), t === 2 ? 100n : 1n),
    r = n < 0n ? -n : n,
    i = t === 2 ? 100n : 10000n;
  return `${n < 0n ? `-` : ``}${r / i}.${String(r % i).padStart(t, `0`)}`;
}
function Ne(e) {
  let [t, n] = Me(e).split(`.`);
  return `GH₵ ${t.replace(/\B(?=(\d{3})+(?!\d))/g, `,`)}.${n}`;
}
p({ v: g(c(), ee(), u(1)) });
var W = g(
    x,
    S((e) => e.toLowerCase()),
  ),
  G = g(c(), ee(), u(0), b(1e4)),
  Pe = h([`standard`, `zero-rated`, `exempt`]),
  Fe = g(
    e(),
    o(/^\d{4}-\d{2}-\d{2}$/),
    m((e) => {
      let t = new Date(`${e}T00:00:00Z`);
      return (
        !e.startsWith(`0000-`) && !Number.isNaN(t.valueOf()) && t.toISOString().slice(0, 10) === e
      );
    }, `Expected a calendar date`),
  ),
  Ie = p({
    id: g(e(), ne()),
    effectiveFrom: Fe,
    vatBps: G,
    nhilBps: G,
    getfundBps: G,
    covidBps: G,
  });
(Object.freeze({
  effectiveFrom: `2026-01-01`,
  vatBps: 1500,
  nhilBps: 250,
  getfundBps: 250,
  covidBps: 0,
  source: `https://gra.gov.gh/news/portfolio/notice-to-all-vat-registered-taxpayers/`,
}),
  h([`inclusive`, `exclusive`]),
  g(c(), v(), u(0)));
var K = g(c(), v(), S(U)),
  q = g(c(), v(), u(0), S(U)),
  Le = f({ base: K, vat: K, nhil: K, getfund: K, covid: K, gross: K, roundingAdjustment: K }),
  Re = f({
    ...Le.entries,
    rule: f({ ...Ie.entries, id: W }),
    on: Fe,
    taxClass: Pe,
    priceMode: h([`inclusive`, `exclusive`]),
    quantityThousandths: g(c(), v(), u(1)),
    unitPrice: q,
    discount: q,
  }),
  ze = f({
    id: W,
    localId: W,
    orgId: W,
    deviceId: W,
    storeId: W,
    branchId: W,
    cashierId: W,
    sessionId: W,
    appVersion: g(e(), l(1)),
    deviceTime: g(e(), r()),
    lines: g(
      C(
        f({
          id: W,
          productId: W,
          priceId: W,
          sku: e(),
          name: e(),
          baseUnit: h([`each`, `kg`, `g`, `l`, `ml`]),
          tax: Re,
        }),
      ),
      l(1),
    ),
    totals: Le,
  }),
  Be = f({
    ...ze.entries,
    receiptNumber: a(g(e(), o(/^BR[0-9]+-T[0-9]+-X?[0-9]{6,}$/))),
    receiptOverflow: y(),
    clockOffsetMs: g(c(), v()),
  });
(f({ v: d(2), type: d(`sale.recorded`), sale: Be }),
  f({ lines: g(C(f({ productId: W, quantityThousandths: g(c(), v(), u(1)) })), l(1)) }),
  f({ v: d(1), type: d(`sale.recorded`), sale: ze }));
var J = g(e(), r()),
  Y = {
    id: W,
    orgId: W,
    sku: e(),
    name: e(),
    baseUnit: h([`each`, `kg`, `g`, `l`, `ml`]),
    taxClass: Pe,
    archivedAt: a(J),
  };
p(Y);
var Ve = C(f({ code: e(), quantityThousandths: g(c(), v(), u(1)) })),
  He = f({ ...Y, barcodes: Ve }),
  X = f({
    id: W,
    orgId: W,
    productId: W,
    branchId: a(W),
    amount: g(c(), v(), u(0), S(U)),
    validFrom: J,
    validTo: a(J),
  }),
  Z = f({ ...Ie.entries, id: W, orgId: W, source: e() }),
  Q = g(
    re({ id: W }),
    s(({ dataset: e, addIssue: t, NEVER: n }) => {
      let { id: r, ...i } = e.value,
        a = _(H, i);
      return a.success ? { id: r, ...a.output } : (t({ message: `Invalid barcode mapping` }), n);
    }),
  );
f({
  products: C(f({ ...Y, barcodes: n(Ve, []) })),
  prices: C(X),
  taxRules: C(Z),
  barcodeMappings: n(C(Q), []),
});
var Ue = f({ products: C(He), prices: C(X), taxRules: C(Z), barcodeMappings: C(Q) }),
  $ = { product: He, price: X, "tax-rule": Z, "barcode-mapping": Q },
  We = p({ id: W });
(g(
  re({ seq: ie, entityId: e(), entity: h(Object.keys($)), op: h([`upsert`, `delete`]), v: d(2) }),
  s(({ dataset: e, addIssue: t, NEVER: n }) => {
    let r = e.value,
      i = r.op === `delete` ? We : $[r.entity],
      a = _(i, r.payload);
    return a.success
      ? { ...r, payload: a.output }
      : (t({ message: `Invalid reference change payload` }), n);
  }),
),
  p({ v: d(2), orgId: W, storeId: W, cursor: ie, reference: Ue }),
  f({
    id: W,
    orgId: W,
    deviceId: W,
    branchId: W,
    userId: W,
    roleName: e(),
    issuedAt: g(e(), r()),
    expiresAt: g(e(), r()),
    permissions: C(e()),
    proof: g(e(), l(1)),
  }));
var Ge = f({ branchCode: g(e(), o(/^BR[0-9]+$/)), deviceCode: g(e(), o(/^T[0-9]+$/)) });
p({
  orgId: W,
  deviceId: W,
  storeId: W,
  branchId: W,
  appVersion: g(e(), l(1)),
  receiptCodes: n(Ge),
});
export {
  de as _,
  Te as a,
  ge as c,
  Se as d,
  he as f,
  ue as g,
  ve as h,
  U as i,
  be as l,
  ye as m,
  je as n,
  we as o,
  N as p,
  Me as r,
  H as s,
  Ne as t,
  xe as u,
};
