import { Bt as e, Ht as t, Wt as n, _ as r, u as i } from "./createLucideIcon-BBeoGZx-.js";
import { t as a } from "./useQuery-DCYgzPRk.js";
import { t as o } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as s, t as c } from "./text-BG7k3Olz.js";
import { t as l } from "./data-X9pOYu-7.js";
import { n as u, r as d, t as f } from "./alert-BTZapdK4.js";
import { a as p, d as m } from "./field-BUpdDBSZ.js";
import { i as h } from "./schemas-CMFvL3XH.js";
import { t as g } from "./store-BMentYd9.js";
import {
  $ as _,
  F as v,
  I as y,
  L as b,
  P as x,
  Q as S,
  b as C,
  dt as w,
  st as T,
  v as E,
  x as D,
  y as O,
} from "./index-DZbZvBMN.js";
import { i as k, t as A } from "./online-B_7Uj1Wv.js";
import { a as j, i as M, n as N, o as P, r as F, s as I, t as L } from "./panel-CiofwA_P.js";
import { t as R } from "./dialog-D2WADKSD.js";
import { t as z } from "./money-C9BcWvGa.js";
var ee = n(t(), 1),
  B = r(),
  V = e();
function H(e) {
  let t = (0, B.c)(20),
    { store: n, open: r, onOpenChange: i, branchCount: a, restoreFocus: o } = e,
    s;
  t[0] === i ? (s = t[1]) : ((s = () => i(!1)), (t[0] = i), (t[1] = s));
  let c = C(s),
    l = n?.name ?? `this store`,
    u =
      a && a > 0
        ? `${l} still has ${a} ${a === 1 ? `branch` : `branches`}. Delete or move ${a === 1 ? `it` : `them`} first.`
        : void 0,
    d;
  t[2] !== i || t[3] !== c
    ? ((d = (e) => {
        (e || c.reset(), i(e));
      }),
      (t[2] = i),
      (t[3] = c),
      (t[4] = d))
    : (d = t[4]);
  let f = `Delete ${l}?`,
    p;
  t[5] !== l || t[6] !== c.error
    ? ((p = c.error ? E(c.error, l) : void 0), (t[5] = l), (t[6] = c.error), (t[7] = p))
    : (p = t[7]);
  let m;
  t[8] !== c || t[9] !== n
    ? ((m = () => n && c.mutate(n)), (t[8] = c), (t[9] = n), (t[10] = m))
    : (m = t[10]);
  let h;
  return (
    t[11] !== u ||
    t[12] !== r ||
    t[13] !== c.isPending ||
    t[14] !== o ||
    t[15] !== d ||
    t[16] !== f ||
    t[17] !== p ||
    t[18] !== m
      ? ((h = (0, V.jsx)(R, {
          open: r,
          onOpenChange: d,
          title: f,
          description: `This removes the store. It can't be undone.`,
          confirmLabel: `Delete store`,
          blocked: u,
          error: p,
          pending: c.isPending,
          onConfirm: m,
          restoreFocus: o,
        })),
        (t[11] = u),
        (t[12] = r),
        (t[13] = c.isPending),
        (t[14] = o),
        (t[15] = d),
        (t[16] = f),
        (t[17] = p),
        (t[18] = m),
        (t[19] = h))
      : (h = t[19]),
    h
  );
}
function U(e) {
  let t = (0, B.c)(40),
    { store: n, onSaved: r } = e,
    i = A(),
    a = D(n, r),
    o;
  t[0] === n ? (o = t[1]) : ((o = n ? y(n) : x), (t[0] = n), (t[1] = o));
  let l;
  t[2] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((l = { onSubmit: v }), (t[2] = l))
    : (l = t[2]);
  let h;
  t[3] === a
    ? (h = t[4])
    : ((h = (e) => {
        let { value: t } = e;
        return a.mutate(t);
      }),
      (t[3] = a),
      (t[4] = h));
  let g;
  t[5] !== o || t[6] !== h
    ? ((g = { defaultValues: o, validators: l, onSubmit: h, onSubmitInvalid: d }),
      (t[5] = o),
      (t[6] = h),
      (t[7] = g))
    : (g = t[7]);
  let _ = s(g),
    b;
  t[8] !== _ || t[9] !== i || t[10] !== a.isPending
    ? ((b = {
        "Mod+Enter": () => {
          i && !a.isPending && _.handleSubmit();
        },
      }),
      (t[8] = _),
      (t[9] = i),
      (t[10] = a.isPending),
      (t[11] = b))
    : (b = t[11]);
  let S = k(b),
    C;
  t[12] === a
    ? (C = t[13])
    : ((C = () => {
        a.isError && a.reset();
      }),
      (t[12] = a),
      (t[13] = C));
  let w = C,
    T;
  t[14] === _
    ? (T = t[15])
    : ((T = (e) => {
        (e.preventDefault(), _.handleSubmit());
      }),
      (t[14] = _),
      (t[15] = T));
  let E;
  t[16] === w
    ? (E = t[17])
    : ((E = (e) =>
        (0, V.jsx)(c, {
          field: e,
          label: `Name`,
          autoFocus: !0,
          autoComplete: `off`,
          onChange: w,
        })),
      (t[16] = w),
      (t[17] = E));
  let O;
  t[18] !== _.Field || t[19] !== E
    ? ((O = (0, V.jsx)(_.Field, { name: `name`, children: E })),
      (t[18] = _.Field),
      (t[19] = E),
      (t[20] = O))
    : (O = t[20]);
  let j;
  t[21] === w
    ? (j = t[22])
    : ((j = (e) =>
        (0, V.jsx)(c, {
          field: e,
          label: `Cash rounding (GH₵)`,
          description: `The smallest amount a cash total is rounded to, like 0.05.`,
          inputMode: `decimal`,
          autoComplete: `off`,
          onChange: w,
        })),
      (t[21] = w),
      (t[22] = j));
  let M;
  t[23] !== _.Field || t[24] !== j
    ? ((M = (0, V.jsx)(_.Field, { name: `cashRounding`, children: j })),
      (t[23] = _.Field),
      (t[24] = j),
      (t[25] = M))
    : (M = t[25]);
  let N;
  t[26] === a.error
    ? (N = t[27])
    : ((N =
        a.error &&
        (0, V.jsxs)(f, {
          variant: `destructive`,
          children: [
            (0, V.jsx)(m, { "aria-hidden": !0 }),
            (0, V.jsx)(u, { children: a.error.message }),
          ],
        })),
      (t[26] = a.error),
      (t[27] = N));
  let F;
  t[28] !== M || t[29] !== N || t[30] !== O
    ? ((F = (0, V.jsxs)(p, { className: `flex-1 overflow-y-auto px-4`, children: [O, M, N] })),
      (t[28] = M),
      (t[29] = N),
      (t[30] = O),
      (t[31] = F))
    : (F = t[31]);
  let I;
  t[32] !== i || t[33] !== a.isPending
    ? ((I = (0, V.jsx)(P, { label: `Save store`, pending: a.isPending, online: i })),
      (t[32] = i),
      (t[33] = a.isPending),
      (t[34] = I))
    : (I = t[34]);
  let L;
  return (
    t[35] !== S || t[36] !== F || t[37] !== I || t[38] !== T
      ? ((L = (0, V.jsxs)(`form`, {
          ref: S,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: T,
          children: [F, I],
        })),
        (t[35] = S),
        (t[36] = F),
        (t[37] = I),
        (t[38] = T),
        (t[39] = L))
      : (L = t[39]),
    L
  );
}
function W(e) {
  let t = (0, B.c)(10),
    { stores: n, onEdit: r, onDelete: i } = e,
    a;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = {
        id: `name`,
        header: `Store`,
        meta: { className: `whitespace-normal font-medium` },
        cell: J,
      }),
      (t[0] = a))
    : (a = t[0]);
  let o;
  t[1] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((o = { id: `rounding`, header: `Cash rounding`, meta: { align: `right` }, cell: q }),
      (t[1] = o))
    : (o = t[1]);
  let s;
  if (t[2] !== i || t[3] !== r) {
    if (((s = [a, o]), r || i)) {
      let e = (e) => {
          let { row: t } = e;
          return (0, V.jsx)(N, {
            id: t.original.id,
            name: t.original.name,
            onEdit: r && (() => r(t.original)),
            onDelete: i && (() => i(t.original)),
          });
        },
        n;
      (t[5] === e
        ? (n = t[6])
        : ((n = { id: `actions`, header: K, cell: e }), (t[5] = e), (t[6] = n)),
        s.push(n));
    }
    ((t[2] = i), (t[3] = r), (t[4] = s));
  } else s = t[4];
  let c;
  return (
    t[7] !== s || t[8] !== n
      ? ((c = (0, V.jsx)(l, {
          label: `Stores`,
          columns: s,
          data: n,
          getRowId: G,
          className: `min-h-0`,
        })),
        (t[7] = s),
        (t[8] = n),
        (t[9] = c))
      : (c = t[9]),
    c
  );
}
function G(e) {
  return e.id;
}
function K() {
  return (0, V.jsx)(`span`, { className: `sr-only`, children: `Actions` });
}
function q(e) {
  let { row: t } = e;
  return (0, V.jsx)(z, { amount: h(t.original.cashRoundingStep) });
}
function J(e) {
  let { row: t } = e;
  return t.original.name;
}
function Y() {
  let e = (0, B.c)(54),
    t;
  e[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((t = O()), (e[0] = t)) : (t = e[0]);
  let { data: n } = o(t),
    r;
  e[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((r = b()), (e[1] = r)) : (r = e[1]);
  let { data: s } = o(r),
    c;
  e[2] === Symbol.for(`react.memo_cache_sentinel`) ? ((c = w()), (e[2] = c)) : (c = e[2]);
  let { data: l } = a(c),
    u = (0, ee.useRef)(null),
    d = L(u),
    f = L(u),
    p = !d.open && !f.open,
    m;
  e[3] === s ? (m = e[4]) : ((m = s.includes(`store.write`)), (e[3] = s), (e[4] = m));
  let h = m,
    v;
  e[5] !== h || e[6] !== d || e[7] !== p
    ? ((v = { N: () => h && p && d.show() }), (e[5] = h), (e[6] = d), (e[7] = p), (e[8] = v))
    : (v = e[8]);
  let y = k(v),
    x = n.length === 0,
    C;
  e[9] === l
    ? (C = e[10])
    : ((C = (e) => (l && e ? l.filter((t) => t.storeId === e.id).length : null)),
      (e[9] = l),
      (e[10] = C));
  let E = C,
    D;
  e[11] !== h || e[12] !== d || e[13] !== x
    ? ((D =
        x || !h ? void 0 : { label: `Add store`, shortcut: `N`, onClick: () => d.show(), ref: u }),
      (e[11] = h),
      (e[12] = d),
      (e[13] = x),
      (e[14] = D))
    : (D = e[14]);
  let A;
  e[15] === D
    ? (A = e[16])
    : ((A = (0, V.jsx)(j, { title: `Stores`, action: D })), (e[15] = D), (e[16] = A));
  let N;
  e[17] === h
    ? (N = e[18])
    : ((N =
        !h &&
        (0, V.jsx)(_, {
          children: `You can view stores. Ask an owner for permission to make changes.`,
        })),
      (e[17] = h),
      (e[18] = N));
  let P;
  e[19] !== h || e[20] !== d || e[21] !== x || e[22] !== f || e[23] !== n
    ? ((P = x
        ? (0, V.jsx)(S, {
            icon: g,
            title: `No stores yet`,
            description: `A store groups your branches and sets how cash totals are rounded. Add one to start.`,
            children:
              h &&
              (0, V.jsxs)(i, {
                ref: u,
                onClick: () => d.show(),
                children: [`Add store`, (0, V.jsx)(T, { "aria-hidden": !0, children: `N` })],
              }),
          })
        : (0, V.jsx)(W, {
            stores: n,
            onEdit: h ? (e) => d.show(e, M(e.id)) : void 0,
            onDelete: h ? (e) => f.show(e, F(e.id)) : void 0,
          })),
      (e[19] = h),
      (e[20] = d),
      (e[21] = x),
      (e[22] = f),
      (e[23] = n),
      (e[24] = P))
    : (P = e[24]);
  let R = d.value ? `Edit store` : `New store`,
    z = d.value ? `Change the name or how cash is rounded.` : `Give the store a name.`,
    G = d.value?.id ?? `new`,
    K;
  e[25] === d ? (K = e[26]) : ((K = () => d.setOpen(!1)), (e[25] = d), (e[26] = K));
  let q;
  e[27] !== d.value || e[28] !== G || e[29] !== K
    ? ((q = (0, V.jsx)(U, { store: d.value, onSaved: K }, G)),
      (e[27] = d.value),
      (e[28] = G),
      (e[29] = K),
      (e[30] = q))
    : (q = e[30]);
  let J;
  e[31] !== d.open ||
  e[32] !== d.restoreFocus ||
  e[33] !== d.setOpen ||
  e[34] !== R ||
  e[35] !== z ||
  e[36] !== q
    ? ((J = (0, V.jsx)(I, {
        open: d.open,
        onOpenChange: d.setOpen,
        title: R,
        description: z,
        restoreFocus: d.restoreFocus,
        children: q,
      })),
      (e[31] = d.open),
      (e[32] = d.restoreFocus),
      (e[33] = d.setOpen),
      (e[34] = R),
      (e[35] = z),
      (e[36] = q),
      (e[37] = J))
    : (J = e[37]);
  let Y = f.value,
    X = f.open,
    te = f.setOpen,
    Z;
  e[38] !== E || e[39] !== f.value
    ? ((Z = E(f.value)), (e[38] = E), (e[39] = f.value), (e[40] = Z))
    : (Z = e[40]);
  let Q;
  e[41] !== f.open ||
  e[42] !== f.restoreFocus ||
  e[43] !== f.setOpen ||
  e[44] !== f.value ||
  e[45] !== Z
    ? ((Q = (0, V.jsx)(H, {
        store: Y,
        open: X,
        onOpenChange: te,
        branchCount: Z,
        restoreFocus: f.restoreFocus,
      })),
      (e[41] = f.open),
      (e[42] = f.restoreFocus),
      (e[43] = f.setOpen),
      (e[44] = f.value),
      (e[45] = Z),
      (e[46] = Q))
    : (Q = e[46]);
  let $;
  return (
    e[47] !== y || e[48] !== J || e[49] !== Q || e[50] !== A || e[51] !== N || e[52] !== P
      ? (($ = (0, V.jsxs)(`div`, {
          ref: y,
          className: `flex min-h-0 flex-1 flex-col gap-6`,
          children: [A, N, P, J, Q],
        })),
        (e[47] = y),
        (e[48] = J),
        (e[49] = Q),
        (e[50] = A),
        (e[51] = N),
        (e[52] = P),
        (e[53] = $))
      : ($ = e[53]),
    $
  );
}
export { Y as StoresScreen };
