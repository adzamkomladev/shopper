import { Bt as e, Ht as t, Wt as n, _ as r, u as i } from "./createLucideIcon-BBeoGZx-.js";
import { t as a } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as o, t as s } from "./text-BG7k3Olz.js";
import { t as c } from "./data-X9pOYu-7.js";
import { n as l, r as u, t as d } from "./alert-BTZapdK4.js";
import { t as f } from "./select-DV5qMU7p.js";
import { a as p, d as m } from "./field-BUpdDBSZ.js";
import { t as h } from "./scan-barcode-q3BnZlwq.js";
import {
  $ as g,
  B as _,
  G as v,
  H as y,
  J as b,
  K as x,
  L as S,
  Q as C,
  U as w,
  V as T,
  W as E,
  X as D,
  Y as O,
  Z as k,
  q as A,
  st as j,
  z as M,
} from "./index-DZbZvBMN.js";
import { i as N, t as P } from "./online-B_7Uj1Wv.js";
import { a as F, i as I, n as L, o as R, r as z, s as B, t as V } from "./panel-CiofwA_P.js";
import { t as H } from "./dialog-D2WADKSD.js";
var U = n(t(), 1),
  W = r(),
  G = e();
function K(e) {
  let t = (0, W.c)(19),
    { mapping: n, open: r, onOpenChange: i, restoreFocus: a } = e,
    o;
  t[0] === i ? (o = t[1]) : ((o = () => i(!1)), (t[0] = i), (t[1] = o));
  let s = _(o),
    c = n?.prefix ?? `this`,
    l;
  t[2] !== i || t[3] !== s
    ? ((l = (e) => {
        (e || s.reset(), i(e));
      }),
      (t[2] = i),
      (t[3] = s),
      (t[4] = l))
    : (l = t[4]);
  let u = `Delete the layout for prefix ${c}?`,
    d;
  t[5] !== c || t[6] !== s.error
    ? ((d = s.error && w(s.error, String(c)).message), (t[5] = c), (t[6] = s.error), (t[7] = d))
    : (d = t[7]);
  let f;
  t[8] !== n || t[9] !== s
    ? ((f = () => n && s.mutate(n)), (t[8] = n), (t[9] = s), (t[10] = f))
    : (f = t[10]);
  let p;
  return (
    t[11] !== r ||
    t[12] !== s.isPending ||
    t[13] !== a ||
    t[14] !== l ||
    t[15] !== u ||
    t[16] !== d ||
    t[17] !== f
      ? ((p = (0, G.jsx)(H, {
          open: r,
          onOpenChange: l,
          title: u,
          description: `Tills will no longer read weights or prices from labels with this prefix. Scanning those labels will no longer add products.`,
          confirmLabel: `Delete layout`,
          error: d,
          pending: s.isPending,
          onConfirm: f,
          restoreFocus: a,
        })),
        (t[11] = r),
        (t[12] = s.isPending),
        (t[13] = a),
        (t[14] = l),
        (t[15] = u),
        (t[16] = d),
        (t[17] = f),
        (t[18] = p))
      : (p = t[18]),
    p
  );
}
var q = {
  prefix: `bg-muted text-muted-foreground`,
  product: `bg-primary text-primary-foreground`,
  value: `bg-success text-success-foreground`,
  conflict: `bg-destructive text-white`,
  check: `bg-muted text-muted-foreground`,
  free: `border border-dashed text-muted-foreground`,
};
function J(e) {
  let t = (0, W.c)(16),
    { layout: n } = e,
    r,
    i,
    a,
    o;
  if (
    t[0] !== n.kind ||
    t[1] !== n.productLength ||
    t[2] !== n.productStart ||
    t[3] !== n.valueLength ||
    t[4] !== n.valueStart
  ) {
    let e = b(Number(n.productStart), Number(n.productLength)),
      s = b(Number(n.valueStart), Number(n.valueLength)),
      c = k(n.kind),
      l = [
        [`prefix`, { first: 1, last: 2 }],
        [`product code`, e],
        [c, s],
        [`check digit`, { first: 13, last: 13 }],
      ].filter(Z),
      u = `Barcode layout: ${l.map(X).join(`, `)}.`;
    ((a = `flex flex-col gap-3`),
      (o = (0, G.jsx)(`div`, {
        role: `img`,
        "aria-label": u,
        className: `grid grid-cols-13 gap-1`,
        children: x.map((t) =>
          (0, G.jsx)(
            `span`,
            {
              "aria-hidden": !0,
              className: `flex aspect-square items-center justify-center rounded-sm text-xs font-medium tabular-nums ${q[O(t, e, s)]}`,
              children: t,
            },
            t,
          ),
        ),
      })),
      (r = `flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground`),
      (i = l.map(Y)),
      (t[0] = n.kind),
      (t[1] = n.productLength),
      (t[2] = n.productStart),
      (t[3] = n.valueLength),
      (t[4] = n.valueStart),
      (t[5] = r),
      (t[6] = i),
      (t[7] = a),
      (t[8] = o));
  } else ((r = t[5]), (i = t[6]), (a = t[7]), (o = t[8]));
  let s;
  t[9] !== r || t[10] !== i
    ? ((s = (0, G.jsx)(`ul`, { className: r, children: i })), (t[9] = r), (t[10] = i), (t[11] = s))
    : (s = t[11]);
  let c;
  return (
    t[12] !== a || t[13] !== o || t[14] !== s
      ? ((c = (0, G.jsxs)(`div`, { className: a, children: [o, s] })),
        (t[12] = a),
        (t[13] = o),
        (t[14] = s),
        (t[15] = c))
      : (c = t[15]),
    c
  );
}
function Y(e) {
  let [t, n] = e;
  return (0, G.jsxs)(`li`, { children: [t.charAt(0).toUpperCase() + t.slice(1), `, `, A(n)] }, t);
}
function X(e) {
  let [t, n] = e;
  return `${A(n)} ${t}`;
}
function Z(e) {
  return !!e[1];
}
var Q = [
    { value: `weight`, label: `Weight` },
    { value: `price`, label: `Price` },
  ],
  $ = [
    { value: `kg`, label: `Kilograms (kg)` },
    { value: `g`, label: `Grams (g)` },
  ];
function ee(e) {
  let t = (0, W.c)(70),
    { mapping: n, layouts: r, onSaved: i } = e,
    a = P(),
    c = T(n, i),
    f;
  if (t[0] !== r || t[1] !== n?.id) {
    let e;
    (t[3] === n?.id ? (e = t[4]) : ((e = (e) => e.id !== n?.id), (t[3] = n?.id), (t[4] = e)),
      (f = new Set(r.filter(e).map(oe))),
      (t[0] = r),
      (t[1] = n?.id),
      (t[2] = f));
  } else f = t[2];
  let h = f,
    g;
  t[5] === n ? (g = t[6]) : ((g = n ? v(n) : y), (t[5] = n), (t[6] = g));
  let _;
  t[7] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((_ = { onSubmit: E }), (t[7] = _))
    : (_ = t[7]);
  let b;
  t[8] === c
    ? (b = t[9])
    : ((b = (e) => {
        let { value: t } = e;
        return c.mutate(t);
      }),
      (t[8] = c),
      (t[9] = b));
  let x;
  t[10] !== g || t[11] !== b
    ? ((x = { defaultValues: g, validators: _, onSubmit: b, onSubmitInvalid: u }),
      (t[10] = g),
      (t[11] = b),
      (t[12] = x))
    : (x = t[12]);
  let S = o(x),
    C;
  t[13] !== S || t[14] !== a || t[15] !== c.isPending
    ? ((C = {
        "Mod+Enter": () => {
          a && !c.isPending && S.handleSubmit();
        },
      }),
      (t[13] = S),
      (t[14] = a),
      (t[15] = c.isPending),
      (t[16] = C))
    : (C = t[16]);
  let D = N(C),
    O;
  t[17] === c
    ? (O = t[18])
    : ((O = () => {
        c.isError && c.reset();
      }),
      (t[17] = c),
      (t[18] = O));
  let k = O,
    A;
  t[19] !== S || t[20] !== c.error
    ? ((A = c.error && w(c.error, S.getFieldValue(`prefix`))),
      (t[19] = S),
      (t[20] = c.error),
      (t[21] = A))
    : (A = t[21]);
  let j = A,
    M;
  t[22] !== k || t[23] !== S.Field
    ? ((M = (e, t) =>
        (0, G.jsx)(S.Field, {
          name: e,
          children: (e) =>
            (0, G.jsx)(s, {
              field: e,
              label: t,
              inputMode: `numeric`,
              autoComplete: `off`,
              onChange: k,
            }),
        })),
      (t[22] = k),
      (t[23] = S.Field),
      (t[24] = M))
    : (M = t[24]);
  let F = M,
    I;
  t[25] === S
    ? (I = t[26])
    : ((I = (e) => {
        (e.preventDefault(), S.handleSubmit());
      }),
      (t[25] = S),
      (t[26] = I));
  let L;
  t[27] === S.Subscribe
    ? (L = t[28])
    : ((L = (0, G.jsx)(S.Subscribe, { selector: ae, children: ie })),
      (t[27] = S.Subscribe),
      (t[28] = L));
  let z;
  t[29] === h
    ? (z = t[30])
    : ((z = {
        onSubmit: (e) => {
          let { value: t } = e;
          return h.has(Number(t))
            ? { message: `Prefix ${t.trim()} already has a layout. Edit that one instead.` }
            : void 0;
        },
      }),
      (t[29] = h),
      (t[30] = z));
  let B;
  t[31] !== k || t[32] !== j
    ? ((B = (e) =>
        (0, G.jsx)(s, {
          field: e,
          label: `Prefix`,
          autoFocus: !0,
          inputMode: `numeric`,
          autoComplete: `off`,
          description: `The two digits every label of this kind starts with, from 20 to 29.`,
          serverError: j && `field` in j ? j.message : void 0,
          onChange: k,
        })),
      (t[31] = k),
      (t[32] = j),
      (t[33] = B))
    : (B = t[33]);
  let V;
  t[34] !== S.Field || t[35] !== z || t[36] !== B
    ? ((V = (0, G.jsx)(S.Field, { name: `prefix`, validators: z, children: B })),
      (t[34] = S.Field),
      (t[35] = z),
      (t[36] = B),
      (t[37] = V))
    : (V = t[37]);
  let H;
  t[38] === S.Field
    ? (H = t[39])
    : ((H = (0, G.jsx)(S.Field, { name: `kind`, children: re })), (t[38] = S.Field), (t[39] = H));
  let U;
  t[40] === S.Field
    ? (U = t[41])
    : ((U = (e) => e === `weight` && (0, G.jsx)(S.Field, { name: `unit`, children: te })),
      (t[40] = S.Field),
      (t[41] = U));
  let K;
  t[42] !== S.Subscribe || t[43] !== U
    ? ((K = (0, G.jsx)(S.Subscribe, { selector: ne, children: U })),
      (t[42] = S.Subscribe),
      (t[43] = U),
      (t[44] = K))
    : (K = t[44]);
  let q;
  t[45] === F
    ? (q = t[46])
    : ((q = (0, G.jsxs)(`div`, {
        className: `grid grid-cols-2 gap-4`,
        children: [
          F(`productStart`, `Product code starts at digit`),
          F(`productLength`, `Product code length (digits)`),
          F(`valueStart`, `Value starts at digit`),
          F(`valueLength`, `Value length (digits)`),
        ],
      })),
      (t[45] = F),
      (t[46] = q));
  let J;
  t[47] === k
    ? (J = t[48])
    : ((J = (e) =>
        (0, G.jsx)(s, {
          field: e,
          label: `Decimal places`,
          inputMode: `numeric`,
          autoComplete: `off`,
          description: `How many of the value's digits come after the decimal point. With 3, the digits 01250 mean 1.250.`,
          onChange: k,
        })),
      (t[47] = k),
      (t[48] = J));
  let Y;
  t[49] !== S.Field || t[50] !== J
    ? ((Y = (0, G.jsx)(S.Field, { name: `decimals`, children: J })),
      (t[49] = S.Field),
      (t[50] = J),
      (t[51] = Y))
    : (Y = t[51]);
  let X;
  t[52] === j
    ? (X = t[53])
    : ((X =
        j &&
        !(`field` in j) &&
        (0, G.jsxs)(d, {
          variant: `destructive`,
          children: [(0, G.jsx)(m, { "aria-hidden": !0 }), (0, G.jsx)(l, { children: j.message })],
        })),
      (t[52] = j),
      (t[53] = X));
  let Z;
  t[54] !== L ||
  t[55] !== V ||
  t[56] !== H ||
  t[57] !== K ||
  t[58] !== q ||
  t[59] !== Y ||
  t[60] !== X
    ? ((Z = (0, G.jsxs)(p, {
        className: `flex-1 overflow-y-auto px-4`,
        children: [L, V, H, K, q, Y, X],
      })),
      (t[54] = L),
      (t[55] = V),
      (t[56] = H),
      (t[57] = K),
      (t[58] = q),
      (t[59] = Y),
      (t[60] = X),
      (t[61] = Z))
    : (Z = t[61]);
  let Q;
  t[62] !== a || t[63] !== c.isPending
    ? ((Q = (0, G.jsx)(R, { label: `Save layout`, pending: c.isPending, online: a })),
      (t[62] = a),
      (t[63] = c.isPending),
      (t[64] = Q))
    : (Q = t[64]);
  let $;
  return (
    t[65] !== D || t[66] !== I || t[67] !== Z || t[68] !== Q
      ? (($ = (0, G.jsxs)(`form`, {
          ref: D,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: I,
          children: [Z, Q],
        })),
        (t[65] = D),
        (t[66] = I),
        (t[67] = Z),
        (t[68] = Q),
        (t[69] = $))
      : ($ = t[69]),
    $
  );
}
function te(e) {
  return (0, G.jsx)(f, { field: e, label: `Weight unit`, options: $ });
}
function ne(e) {
  return e.values.kind;
}
function re(e) {
  return (0, G.jsx)(f, { field: e, label: `Label type`, options: Q });
}
function ie(e) {
  return (0, G.jsx)(J, { layout: e });
}
function ae(e) {
  return e.values;
}
function oe(e) {
  return e.prefix;
}
var se = ({ start: e, length: t }) => D(A(b(e + 1, t))),
  ce = (e) => `${e} ${e === 1 ? `decimal` : `decimals`}`;
function le(e) {
  let t = (0, W.c)(12),
    { mappings: n, onEdit: r, onDelete: i } = e,
    a,
    o,
    s,
    l;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = {
        id: `prefix`,
        header: `Prefix`,
        meta: { className: `font-medium tabular-nums` },
        cell: he,
      }),
      (o = { id: `kind`, header: `Label`, cell: me }),
      (s = { id: `product`, header: `Product code`, cell: pe }),
      (l = { id: `value`, header: `Value`, cell: fe }),
      (t[0] = a),
      (t[1] = o),
      (t[2] = s),
      (t[3] = l))
    : ((a = t[0]), (o = t[1]), (s = t[2]), (l = t[3]));
  let u;
  if (t[4] !== i || t[5] !== r) {
    if (((u = [a, o, s, l]), r || i)) {
      let e = (e) => {
          let { row: t } = e;
          return (0, G.jsx)(L, {
            id: t.original.id,
            name: `prefix ${t.original.prefix}`,
            onEdit: r && (() => r(t.original)),
            onDelete: i && (() => i(t.original)),
          });
        },
        n;
      (t[7] === e
        ? (n = t[8])
        : ((n = { id: `actions`, header: de, cell: e }), (t[7] = e), (t[8] = n)),
        u.push(n));
    }
    ((t[4] = i), (t[5] = r), (t[6] = u));
  } else u = t[6];
  let d;
  return (
    t[9] !== u || t[10] !== n
      ? ((d = (0, G.jsx)(c, {
          label: `Barcode layouts`,
          columns: u,
          data: n,
          getRowId: ue,
          className: `min-h-0`,
        })),
        (t[9] = u),
        (t[10] = n),
        (t[11] = d))
      : (d = t[11]),
    d
  );
}
function ue(e) {
  return e.id;
}
function de() {
  return (0, G.jsx)(`span`, { className: `sr-only`, children: `Actions` });
}
function fe(e) {
  let { row: t } = e;
  return `${se(t.original.value)}, ${ce(t.original.decimals)}`;
}
function pe(e) {
  let { row: t } = e;
  return se(t.original.product);
}
function me(e) {
  let { row: t } = e;
  return t.original.kind === `weight` ? `Weight in ${t.original.unit}` : `Price`;
}
function he(e) {
  let { row: t } = e;
  return t.original.prefix;
}
var ge = 10;
function _e() {
  let e = (0, W.c)(54),
    t;
  e[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((t = S()), (e[0] = t)) : (t = e[0]);
  let { data: n } = a(t),
    r;
  e[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((r = M()), (e[1] = r)) : (r = e[1]);
  let { data: o } = a(r),
    s;
  e[2] === n ? (s = e[3]) : ((s = n.includes(`product.write`)), (e[2] = n), (e[3] = s));
  let c = s,
    l = o.length >= ge,
    u = c && !l,
    d = (0, U.useRef)(null),
    f = V(d),
    p = V(d),
    m;
  e[4] !== u || e[5] !== f || e[6] !== p.open
    ? ((m = { N: () => u && !f.open && !p.open && f.show() }),
      (e[4] = u),
      (e[5] = f),
      (e[6] = p.open),
      (e[7] = m))
    : (m = e[7]);
  let _ = N(m),
    v = o.length === 0,
    y;
  e[8] !== u || e[9] !== f || e[10] !== v
    ? ((y =
        v || !u ? void 0 : { label: `Add layout`, shortcut: `N`, onClick: () => f.show(), ref: d }),
      (e[8] = u),
      (e[9] = f),
      (e[10] = v),
      (e[11] = y))
    : (y = e[11]);
  let b;
  e[12] === y
    ? (b = e[13])
    : ((b = (0, G.jsx)(F, { title: `Barcode layouts`, action: y })), (e[12] = y), (e[13] = b));
  let x;
  e[14] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((x = (0, G.jsx)(`p`, {
        className: `max-w-2xl text-sm text-muted-foreground`,
        children: `Scale and price labels carry a product code and a weight or price inside a 13-digit barcode that starts with 20 to 29. Tell the till where to read each one.`,
      })),
      (e[14] = x))
    : (x = e[14]);
  let w;
  e[15] === c
    ? (w = e[16])
    : ((w =
        !c &&
        (0, G.jsx)(g, {
          children: `You can view barcode layouts. Ask an owner for permission to make changes.`,
        })),
      (e[15] = c),
      (e[16] = w));
  let T;
  e[17] !== c || e[18] !== l
    ? ((T =
        l &&
        c &&
        (0, G.jsx)(g, {
          children: `Every prefix from 20 to 29 has a layout. Edit one to change it.`,
        })),
      (e[17] = c),
      (e[18] = l),
      (e[19] = T))
    : (T = e[19]);
  let E;
  e[20] !== u || e[21] !== c || e[22] !== f || e[23] !== v || e[24] !== o || e[25] !== p
    ? ((E = v
        ? (0, G.jsx)(C, {
            icon: h,
            title: `No barcode layouts yet`,
            description: c
              ? `Add the layout your scale prints, so scanning a label adds the product and its weight.`
              : `Until one is added, tills can't read weights or prices from labels.`,
            children:
              u &&
              (0, G.jsxs)(i, {
                ref: d,
                onClick: () => f.show(),
                children: [`Add layout`, (0, G.jsx)(j, { "aria-hidden": !0, children: `N` })],
              }),
          })
        : (0, G.jsx)(le, {
            mappings: o,
            onEdit: c ? (e) => f.show(e, I(e.id)) : void 0,
            onDelete: c ? (e) => p.show(e, z(e.id)) : void 0,
          })),
      (e[20] = u),
      (e[21] = c),
      (e[22] = f),
      (e[23] = v),
      (e[24] = o),
      (e[25] = p),
      (e[26] = E))
    : (E = e[26]);
  let D = f.value ? `Edit layout` : `New layout`,
    O = f.value
      ? `Change where the till reads this label's digits.`
      : `Say which digits hold the product code and the weight or price.`,
    k = f.value?.id ?? `new`,
    A;
  e[27] === f ? (A = e[28]) : ((A = () => f.setOpen(!1)), (e[27] = f), (e[28] = A));
  let P;
  e[29] !== f.value || e[30] !== o || e[31] !== k || e[32] !== A
    ? ((P = (0, G.jsx)(ee, { mapping: f.value, layouts: o, onSaved: A }, k)),
      (e[29] = f.value),
      (e[30] = o),
      (e[31] = k),
      (e[32] = A),
      (e[33] = P))
    : (P = e[33]);
  let L;
  e[34] !== f.open ||
  e[35] !== f.restoreFocus ||
  e[36] !== f.setOpen ||
  e[37] !== D ||
  e[38] !== O ||
  e[39] !== P
    ? ((L = (0, G.jsx)(B, {
        open: f.open,
        onOpenChange: f.setOpen,
        title: D,
        description: O,
        restoreFocus: f.restoreFocus,
        children: P,
      })),
      (e[34] = f.open),
      (e[35] = f.restoreFocus),
      (e[36] = f.setOpen),
      (e[37] = D),
      (e[38] = O),
      (e[39] = P),
      (e[40] = L))
    : (L = e[40]);
  let R;
  e[41] !== p.open || e[42] !== p.restoreFocus || e[43] !== p.setOpen || e[44] !== p.value
    ? ((R = (0, G.jsx)(K, {
        mapping: p.value,
        open: p.open,
        onOpenChange: p.setOpen,
        restoreFocus: p.restoreFocus,
      })),
      (e[41] = p.open),
      (e[42] = p.restoreFocus),
      (e[43] = p.setOpen),
      (e[44] = p.value),
      (e[45] = R))
    : (R = e[45]);
  let H;
  return (
    e[46] !== _ ||
    e[47] !== L ||
    e[48] !== R ||
    e[49] !== b ||
    e[50] !== w ||
    e[51] !== T ||
    e[52] !== E
      ? ((H = (0, G.jsxs)(`div`, {
          ref: _,
          className: `flex min-h-0 flex-1 flex-col gap-6`,
          children: [b, x, w, T, E, L, R],
        })),
        (e[46] = _),
        (e[47] = L),
        (e[48] = R),
        (e[49] = b),
        (e[50] = w),
        (e[51] = T),
        (e[52] = E),
        (e[53] = H))
      : (H = e[53]),
    H
  );
}
export { _e as MappingsScreen };
