import { Bt as e, Ht as t, Wt as n, _ as r, t as i, u as a } from "./createLucideIcon-BBeoGZx-.js";
import { t as o } from "./link-BaidU34I.js";
import { t as s } from "./useQuery-DCYgzPRk.js";
import { t as c } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as l, t as u } from "./text-BG7k3Olz.js";
import { a as d, n as f, r as p, t as m } from "./alert-BTZapdK4.js";
import { t as h } from "./select-DV5qMU7p.js";
import { a as g, d as _, l as v, n as y, o as b, r as x, t as S } from "./field-BUpdDBSZ.js";
import { t as C } from "./switch-DZfgHEV-.js";
import { i as w } from "./schemas-CMFvL3XH.js";
import {
  At as T,
  Ct as E,
  Et as D,
  Ft as O,
  Gt as k,
  It as A,
  Lt as j,
  Mt as M,
  Nt as N,
  Pt as ee,
  Rt as P,
  St as F,
  Tt as te,
  _t as I,
  bt as L,
  dt as R,
  ft as z,
  gt as B,
  ht as ne,
  jt as V,
  kt as H,
  mt as U,
  pt as W,
  st as re,
  vt as G,
  wt as K,
  xt as q,
  yt as ie,
  zt as J,
} from "./index-DZbZvBMN.js";
import { i as ae, n as oe, t as se } from "./online-B_7Uj1Wv.js";
import { a as ce, i as le, n as ue, o as Y, r as X, s as Z, t as de } from "./dialog-CiSY6Yg1.js";
import { n as fe, r as pe, t as me } from "./options-C9HrHlKt.js";
import { t as he } from "./money-C9BcWvGa.js";
import { t as ge } from "./now-CmhBBvQa.js";
import { n as _e, r as ve, t as ye } from "./groups-C7d-M_Dy.js";
var be = {
  name: `arrow-left`,
  size: 24,
  node: [
    [`path`, { d: `m12 19-7-7 7-7`, key: `1l729n` }],
    [`path`, { d: `M19 12H5`, key: `x3x0zl` }],
  ],
};
be.node;
var xe = i(be),
  Se = {
    name: `tag`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z`,
          key: `vktsd0`,
        },
      ],
      [`circle`, { cx: `7.5`, cy: `7.5`, r: `.5`, fill: `currentColor`, key: `kqv944` }],
    ],
  };
Se.node;
var Ce = i(Se),
  we = {
    name: `trash`,
    size: 24,
    node: [
      [`path`, { d: `M10 11v6`, key: `nco0om` }],
      [`path`, { d: `M14 11v6`, key: `outv1u` }],
      [`path`, { d: `M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6`, key: `miytrc` }],
      [`path`, { d: `M3 6h18`, key: `d0wm0j` }],
      [`path`, { d: `M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2`, key: `e791ji` }],
    ],
    aliases: [`trash-2`],
  };
we.node;
var Te = i(we),
  Ee = n(t(), 1),
  Q = r(),
  $ = e(),
  De = `barcodes-offline-note`,
  Oe = 1e3;
function ke(e) {
  let t = (0, Q.c)(16),
    { product: n } = e,
    r = se(),
    i = U(n.id),
    o = r ? void 0 : De,
    s;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((s = (0, $.jsxs)(P, {
        children: [
          (0, $.jsx)(J, {
            id: `barcodes-title`,
            role: `heading`,
            "aria-level": 2,
            children: `Barcodes`,
          }),
          (0, $.jsx)(A, {
            children: `Scanning any of these finds this product. A pack barcode sells several at once.`,
          }),
        ],
      })),
      (t[0] = s))
    : (s = t[0]);
  let c;
  t[1] !== o || t[2] !== r || t[3] !== n.barcodes || t[4] !== i
    ? ((c =
        n.barcodes.length === 0
          ? (0, $.jsx)(`p`, {
              className: `text-sm text-muted-foreground`,
              children: `No barcodes yet. Add the code printed on the pack.`,
            })
          : (0, $.jsx)(`ul`, {
              className: `divide-y rounded-lg border`,
              children: n.barcodes.map((e) =>
                (0, $.jsxs)(
                  `li`,
                  {
                    className: `flex items-center gap-3 py-2 pr-2 pl-4`,
                    children: [
                      (0, $.jsxs)(`div`, {
                        className: `flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3`,
                        children: [
                          (0, $.jsx)(`span`, {
                            className: `font-medium tabular-nums`,
                            children: e.code,
                          }),
                          (0, $.jsx)(`span`, {
                            className: `text-sm text-muted-foreground tabular-nums`,
                            children: je(e.quantityThousandths),
                          }),
                        ],
                      }),
                      (0, $.jsx)(a, {
                        type: `button`,
                        variant: `ghost`,
                        size: `icon`,
                        "aria-label": `Remove barcode ${e.code}`,
                        "aria-describedby": o,
                        disabled: !r || i.isPending,
                        onClick: () => i.mutate(e),
                        children: (0, $.jsx)(Te, { "aria-hidden": !0 }),
                      }),
                    ],
                  },
                  e.code,
                ),
              ),
            })),
      (t[1] = o),
      (t[2] = r),
      (t[3] = n.barcodes),
      (t[4] = i),
      (t[5] = c))
    : (c = t[5]);
  let l;
  t[6] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((l = (0, $.jsx)(v, {})), (t[6] = l))
    : (l = t[6]);
  let u;
  t[7] !== r || t[8] !== n.id
    ? ((u = (0, $.jsx)(Ae, { productId: n.id, online: r })), (t[7] = r), (t[8] = n.id), (t[9] = u))
    : (u = t[9]);
  let d;
  t[10] === r
    ? (d = t[11])
    : ((d =
        !r &&
        (0, $.jsx)(`p`, {
          id: De,
          className: `text-sm text-muted-foreground`,
          children: `You're offline. Reconnect to change barcodes.`,
        })),
      (t[10] = r),
      (t[11] = d));
  let f;
  return (
    t[12] !== c || t[13] !== u || t[14] !== d
      ? ((f = (0, $.jsxs)(ee, {
          role: `region`,
          "aria-labelledby": `barcodes-title`,
          children: [
            s,
            (0, $.jsxs)(O, { className: `flex flex-col gap-6`, children: [c, l, u, d] }),
          ],
        })),
        (t[12] = c),
        (t[13] = u),
        (t[14] = d),
        (t[15] = f))
      : (f = t[15]),
    f
  );
}
function Ae(e) {
  let t = (0, Q.c)(35),
    { productId: n, online: r } = e,
    i;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((i = { onSubmit: L }), (t[0] = i))
    : (i = t[0]);
  let o = l({
      defaultValues: F,
      validators: i,
      onSubmit: (e) => {
        let { value: t } = e;
        r && c.mutate(t);
      },
      onSubmitInvalid: p,
    }),
    s;
  t[1] === o
    ? (s = t[2])
    : ((s = () => {
        (o.reset(), document.getElementById(`code`)?.focus());
      }),
      (t[1] = o),
      (t[2] = s));
  let c = W(n, s),
    d;
  t[3] === c
    ? (d = t[4])
    : ((d = () => {
        c.isError && c.reset();
      }),
      (t[3] = c),
      (t[4] = d));
  let h = d,
    v;
  t[5] === c.error
    ? (v = t[6])
    : ((v = (...e) => {
        let t = e;
        return K(c.error, ...t);
      }),
      (t[5] = c.error),
      (t[6] = v));
  let y = v,
    b;
  t[7] === o
    ? (b = t[8])
    : ((b = (e) => {
        (e.preventDefault(), o.handleSubmit());
      }),
      (t[7] = o),
      (t[8] = b));
  let x;
  t[9] !== h || t[10] !== y
    ? ((x = (e) =>
        (0, $.jsx)(u, {
          field: e,
          label: `Barcode`,
          autoComplete: `off`,
          inputMode: `numeric`,
          serverError: y(`code`, `barcodes`),
          onChange: h,
        })),
      (t[9] = h),
      (t[10] = y),
      (t[11] = x))
    : (x = t[11]);
  let S;
  t[12] !== o.Field || t[13] !== x
    ? ((S = (0, $.jsx)(o.Field, { name: `code`, children: x })),
      (t[12] = o.Field),
      (t[13] = x),
      (t[14] = S))
    : (S = t[14]);
  let C;
  t[15] !== h || t[16] !== y
    ? ((C = (e) =>
        (0, $.jsx)(u, {
          field: e,
          label: `Pack quantity`,
          inputMode: `numeric`,
          autoComplete: `off`,
          serverError: y(`quantityThousandths`),
          onChange: h,
        })),
      (t[15] = h),
      (t[16] = y),
      (t[17] = C))
    : (C = t[17]);
  let w;
  t[18] !== o.Field || t[19] !== C
    ? ((w = (0, $.jsx)(o.Field, { name: `quantity`, children: C })),
      (t[18] = o.Field),
      (t[19] = C),
      (t[20] = w))
    : (w = t[20]);
  let T;
  t[21] !== w || t[22] !== S
    ? ((T = (0, $.jsxs)(g, { children: [S, w] })), (t[21] = w), (t[22] = S), (t[23] = T))
    : (T = t[23]);
  let E;
  t[24] === c.error
    ? (E = t[25])
    : ((E =
        c.error &&
        !K(c.error, ...I) &&
        (0, $.jsxs)(m, {
          variant: `destructive`,
          children: [
            (0, $.jsx)(_, { "aria-hidden": !0 }),
            (0, $.jsx)(f, { children: te(c.error) }),
          ],
        })),
      (t[24] = c.error),
      (t[25] = E));
  let D = !r || c.isPending,
    O = r ? void 0 : De,
    k = c.isPending ? `Adding…` : `Add barcode`,
    A;
  t[26] !== D || t[27] !== O || t[28] !== k
    ? ((A = (0, $.jsx)(a, {
        type: `submit`,
        variant: `outline`,
        className: `self-end`,
        disabled: D,
        "aria-describedby": O,
        children: k,
      })),
      (t[26] = D),
      (t[27] = O),
      (t[28] = k),
      (t[29] = A))
    : (A = t[29]);
  let j;
  return (
    t[30] !== T || t[31] !== E || t[32] !== A || t[33] !== b
      ? ((j = (0, $.jsxs)(`form`, {
          noValidate: !0,
          className: `flex flex-col gap-4`,
          onSubmit: b,
          children: [T, E, A],
        })),
        (t[30] = T),
        (t[31] = E),
        (t[32] = A),
        (t[33] = b),
        (t[34] = j))
      : (j = t[34]),
    j
  );
}
var je = (e) => (e === Oe ? `Single` : `Pack of ${Me(e)}`);
function Me(e) {
  let t = Math.trunc(e / Oe),
    n = String(e % Oe)
      .padStart(3, `0`)
      .replace(/0+$/, ``);
  return n ? `${t}.${n}` : String(t);
}
var Ne = `details-offline-note`;
function Pe(e) {
  let t = (0, Q.c)(62),
    { product: n, formRef: r } = e,
    i = se(),
    o = B(n.id),
    s;
  t[0] !== n.baseUnit ||
  t[1] !== n.categoryId ||
  t[2] !== n.name ||
  t[3] !== n.onlineVisible ||
  t[4] !== n.sku ||
  t[5] !== n.taxClass
    ? ((s = {
        name: n.name,
        sku: n.sku,
        baseUnit: n.baseUnit,
        taxClass: n.taxClass,
        categoryId: n.categoryId,
        onlineVisible: n.onlineVisible,
      }),
      (t[0] = n.baseUnit),
      (t[1] = n.categoryId),
      (t[2] = n.name),
      (t[3] = n.onlineVisible),
      (t[4] = n.sku),
      (t[5] = n.taxClass),
      (t[6] = s))
    : (s = t[6]);
  let c;
  t[7] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = { onSubmit: q }), (t[7] = c))
    : (c = t[7]);
  let d = l({
      defaultValues: s,
      validators: c,
      onSubmit: (e) => {
        let { value: t } = e;
        i && o.mutate(t, { onSuccess: () => d.reset(t) });
      },
      onSubmitInvalid: p,
    }),
    h;
  t[8] === o
    ? (h = t[9])
    : ((h = () => {
        o.isError && o.reset();
      }),
      (t[8] = o),
      (t[9] = h));
  let v = h,
    y;
  t[10] === o.error ? (y = t[11]) : ((y = (e) => K(o.error, e)), (t[10] = o.error), (t[11] = y));
  let b = y,
    x;
  t[12] === d
    ? (x = t[13])
    : ((x = (e) => {
        (e.preventDefault(), d.handleSubmit());
      }),
      (t[12] = d),
      (t[13] = x));
  let S;
  t[14] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((S = (0, $.jsx)(P, {
        children: (0, $.jsx)(J, {
          id: `details-title`,
          role: `heading`,
          "aria-level": 2,
          children: `Details`,
        }),
      })),
      (t[14] = S))
    : (S = t[14]);
  let C;
  t[15] !== v || t[16] !== b
    ? ((C = (e) =>
        (0, $.jsx)(u, {
          field: e,
          label: `Name`,
          autoComplete: `off`,
          serverError: b(`name`),
          onChange: v,
        })),
      (t[15] = v),
      (t[16] = b),
      (t[17] = C))
    : (C = t[17]);
  let w;
  t[18] !== d.Field || t[19] !== C
    ? ((w = (0, $.jsx)(d.Field, { name: `name`, children: C })),
      (t[18] = d.Field),
      (t[19] = C),
      (t[20] = w))
    : (w = t[20]);
  let T;
  t[21] !== v || t[22] !== b
    ? ((T = (e) =>
        (0, $.jsx)(u, {
          field: e,
          label: `SKU`,
          autoComplete: `off`,
          autoCapitalize: `characters`,
          spellCheck: !1,
          serverError: b(`sku`),
          onChange: v,
        })),
      (t[21] = v),
      (t[22] = b),
      (t[23] = T))
    : (T = t[23]);
  let E;
  t[24] !== d.Field || t[25] !== T
    ? ((E = (0, $.jsx)(d.Field, { name: `sku`, children: T })),
      (t[24] = d.Field),
      (t[25] = T),
      (t[26] = E))
    : (E = t[26]);
  let D;
  t[27] === d.Field
    ? (D = t[28])
    : ((D = (0, $.jsx)(d.Field, { name: `baseUnit`, children: Re })),
      (t[27] = d.Field),
      (t[28] = D));
  let k;
  t[29] === d.Field
    ? (k = t[30])
    : ((k = (0, $.jsx)(d.Field, { name: `taxClass`, children: Le })),
      (t[29] = d.Field),
      (t[30] = k));
  let A;
  t[31] === d.Field
    ? (A = t[32])
    : ((A = (0, $.jsx)(d.Field, { name: `categoryId`, children: Ie })),
      (t[31] = d.Field),
      (t[32] = A));
  let M;
  t[33] === d.Field
    ? (M = t[34])
    : ((M = (0, $.jsx)(d.Field, { name: `onlineVisible`, children: Fe })),
      (t[33] = d.Field),
      (t[34] = M));
  let N;
  t[35] === o.error
    ? (N = t[36])
    : ((N =
        o.error &&
        !K(o.error, ...G) &&
        (0, $.jsxs)(m, {
          variant: `destructive`,
          children: [
            (0, $.jsx)(_, { "aria-hidden": !0 }),
            (0, $.jsx)(f, { children: te(o.error) }),
          ],
        })),
      (t[35] = o.error),
      (t[36] = N));
  let F;
  t[37] !== E ||
  t[38] !== D ||
  t[39] !== k ||
  t[40] !== A ||
  t[41] !== M ||
  t[42] !== N ||
  t[43] !== w
    ? ((F = (0, $.jsx)(O, { children: (0, $.jsxs)(g, { children: [w, E, D, k, A, M, N] }) })),
      (t[37] = E),
      (t[38] = D),
      (t[39] = k),
      (t[40] = A),
      (t[41] = M),
      (t[42] = N),
      (t[43] = w),
      (t[44] = F))
    : (F = t[44]);
  let I;
  t[45] === i
    ? (I = t[46])
    : ((I =
        !i &&
        (0, $.jsx)(`p`, {
          id: Ne,
          className: `text-sm text-muted-foreground`,
          children: `You're offline. Reconnect to save your changes.`,
        })),
      (t[45] = i),
      (t[46] = I));
  let L = !i || o.isPending,
    R = i ? void 0 : Ne,
    z = o.isPending ? `Saving…` : `Save changes`,
    ne;
  t[47] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((ne = (0, $.jsxs)(re, { "aria-hidden": !0, children: [oe, ` ↵`] })), (t[47] = ne))
    : (ne = t[47]);
  let V;
  t[48] !== L || t[49] !== R || t[50] !== z
    ? ((V = (0, $.jsxs)(a, {
        type: `submit`,
        disabled: L,
        "aria-describedby": R,
        children: [z, ne],
      })),
      (t[48] = L),
      (t[49] = R),
      (t[50] = z),
      (t[51] = V))
    : (V = t[51]);
  let H;
  t[52] !== I || t[53] !== V
    ? ((H = (0, $.jsxs)(j, {
        className: `flex-wrap justify-end gap-x-4 gap-y-2`,
        children: [I, V],
      })),
      (t[52] = I),
      (t[53] = V),
      (t[54] = H))
    : (H = t[54]);
  let U;
  t[55] !== F || t[56] !== H
    ? ((U = (0, $.jsxs)(ee, {
        role: `region`,
        "aria-labelledby": `details-title`,
        children: [S, F, H],
      })),
      (t[55] = F),
      (t[56] = H),
      (t[57] = U))
    : (U = t[57]);
  let W;
  return (
    t[58] !== r || t[59] !== U || t[60] !== x
      ? ((W = (0, $.jsx)(`form`, { ref: r, noValidate: !0, onSubmit: x, children: U })),
        (t[58] = r),
        (t[59] = U),
        (t[60] = x),
        (t[61] = W))
      : (W = t[61]),
    W
  );
}
function Fe(e) {
  return (0, $.jsxs)(S, {
    orientation: `horizontal`,
    children: [
      (0, $.jsx)(C, { id: e.name, checked: e.state.value, onCheckedChange: e.handleChange }),
      (0, $.jsxs)(y, {
        children: [
          (0, $.jsx)(b, { htmlFor: e.name, children: `Visible online` }),
          (0, $.jsx)(x, { children: `Customers can find this product in the online shop.` }),
        ],
      }),
    ],
  });
}
function Ie(e) {
  return (0, $.jsxs)(S, {
    children: [
      (0, $.jsx)(b, { htmlFor: e.name, children: `Category` }),
      (0, $.jsx)(pe, { id: e.name, value: e.state.value ?? null, onChange: e.handleChange }),
    ],
  });
}
function Le(e) {
  return (0, $.jsx)(h, { field: e, label: `Tax class`, options: me });
}
function Re(e) {
  return (0, $.jsx)(h, { field: e, label: `Unit`, options: fe });
}
var ze = `price-offline-note`,
  Be = {
    set: {
      title: `Set price`,
      description: `The new price applies straight away. The old one stays in the history.`,
    },
    schedule: {
      title: `Schedule price`,
      description: `The price applies between these times (Ghana time), then the previous price returns.`,
    },
  };
function Ve(e) {
  let t = (0, Q.c)(23),
    { productId: n, mode: r, open: i, onOpenChange: a, restoreFocus: o } = e,
    s;
  t[0] === o
    ? (s = t[1])
    : ((s = (e) => {
        (e.preventDefault(), o());
      }),
      (t[0] = o),
      (t[1] = s));
  let c = Be[r],
    l;
  t[2] === c.title
    ? (l = t[3])
    : ((l = (0, $.jsx)(Z, { children: c.title })), (t[2] = c.title), (t[3] = l));
  let u = Be[r],
    d;
  t[4] === u.description
    ? (d = t[5])
    : ((d = (0, $.jsx)(le, { children: u.description })), (t[4] = u.description), (t[5] = d));
  let f;
  t[6] !== l || t[7] !== d
    ? ((f = (0, $.jsxs)(Y, { children: [l, d] })), (t[6] = l), (t[7] = d), (t[8] = f))
    : (f = t[8]);
  let p;
  t[9] === a ? (p = t[10]) : ((p = () => a(!1)), (t[9] = a), (t[10] = p));
  let m;
  t[11] !== r || t[12] !== n || t[13] !== p
    ? ((m = (0, $.jsx)(He, { productId: n, mode: r, onSaved: p })),
      (t[11] = r),
      (t[12] = n),
      (t[13] = p),
      (t[14] = m))
    : (m = t[14]);
  let h;
  t[15] !== s || t[16] !== f || t[17] !== m
    ? ((h = (0, $.jsxs)(X, { onCloseAutoFocus: s, children: [f, m] })),
      (t[15] = s),
      (t[16] = f),
      (t[17] = m),
      (t[18] = h))
    : (h = t[18]);
  let g;
  return (
    t[19] !== a || t[20] !== i || t[21] !== h
      ? ((g = (0, $.jsx)(de, { open: i, onOpenChange: a, children: h })),
        (t[19] = a),
        (t[20] = i),
        (t[21] = h),
        (t[22] = g))
      : (g = t[22]),
    g
  );
}
function He(e) {
  let t = (0, Q.c)(64),
    { productId: n, mode: r, onSaved: i } = e,
    o = se(),
    c;
  t[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((c = R()), (t[0] = c)) : (c = t[0]);
  let { data: d } = s(c),
    v = d === void 0 ? [] : d,
    y = ne(n, r, i),
    b = D[r],
    x;
  t[1] === b ? (x = t[2]) : ((x = { onSubmit: b }), (t[1] = b), (t[2] = x));
  let S;
  t[3] !== o || t[4] !== y
    ? ((S = (e) => {
        let { value: t } = e;
        o && y.mutate(t);
      }),
      (t[3] = o),
      (t[4] = y),
      (t[5] = S))
    : (S = t[5]);
  let C;
  t[6] !== x || t[7] !== S
    ? ((C = { defaultValues: E, validators: x, onSubmit: S, onSubmitInvalid: p }),
      (t[6] = x),
      (t[7] = S),
      (t[8] = C))
    : (C = t[8]);
  let w = l(C),
    T;
  t[9] !== w || t[10] !== o || t[11] !== y.isPending
    ? ((T = {
        "Mod+Enter": () => {
          o && !y.isPending && w.handleSubmit();
        },
      }),
      (t[9] = w),
      (t[10] = o),
      (t[11] = y.isPending),
      (t[12] = T))
    : (T = t[12]);
  let O = ae(T),
    k;
  t[13] === y
    ? (k = t[14])
    : ((k = () => {
        y.isError && y.reset();
      }),
      (t[13] = y),
      (t[14] = k));
  let A = k,
    j;
  t[15] === y.error ? (j = t[16]) : ((j = (e) => K(y.error, e)), (t[15] = y.error), (t[16] = j));
  let M = j,
    N;
  t[17] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((N = { value: `all`, label: `All branches` }), (t[17] = N))
    : (N = t[17]);
  let ee = [N, ...v.map(Ue)],
    P;
  t[18] === w
    ? (P = t[19])
    : ((P = (e) => {
        (e.preventDefault(), w.handleSubmit());
      }),
      (t[18] = w),
      (t[19] = P));
  let F;
  t[20] !== A || t[21] !== M
    ? ((F = (e) =>
        (0, $.jsx)(u, {
          field: e,
          label: `Amount`,
          description: `In cedis, for example 12.50.`,
          inputMode: `decimal`,
          autoComplete: `off`,
          autoFocus: !0,
          serverError: M(`amount`),
          onChange: A,
        })),
      (t[20] = A),
      (t[21] = M),
      (t[22] = F))
    : (F = t[22]);
  let I;
  t[23] !== w.Field || t[24] !== F
    ? ((I = (0, $.jsx)(w.Field, { name: `amount`, children: F })),
      (t[23] = w.Field),
      (t[24] = F),
      (t[25] = I))
    : (I = t[25]);
  let L = (e) => (0, $.jsx)(h, { field: e, label: `Branch`, options: ee }),
    z;
  t[26] !== w.Field || t[27] !== L
    ? ((z = (0, $.jsx)(w.Field, { name: `branchId`, children: L })),
      (t[26] = w.Field),
      (t[27] = L),
      (t[28] = z))
    : (z = t[28]);
  let B;
  t[29] !== A || t[30] !== M || t[31] !== w.Field || t[32] !== r
    ? ((B =
        r === `schedule` &&
        (0, $.jsxs)($.Fragment, {
          children: [
            (0, $.jsx)(w.Field, {
              name: `startsAt`,
              children: (e) =>
                (0, $.jsx)(u, {
                  field: e,
                  label: `Starts`,
                  type: `datetime-local`,
                  serverError: M(`startsAt`),
                  onChange: A,
                }),
            }),
            (0, $.jsx)(w.Field, {
              name: `endsAt`,
              children: (e) =>
                (0, $.jsx)(u, {
                  field: e,
                  label: `Ends`,
                  type: `datetime-local`,
                  serverError: M(`endsAt`),
                  onChange: A,
                }),
            }),
          ],
        })),
      (t[29] = A),
      (t[30] = M),
      (t[31] = w.Field),
      (t[32] = r),
      (t[33] = B))
    : (B = t[33]);
  let V;
  t[34] !== A || t[35] !== M
    ? ((V = (e) =>
        (0, $.jsx)(u, {
          field: e,
          label: `Reason`,
          description: `Kept in the price history, for example Supplier raised cost.`,
          autoComplete: `off`,
          serverError: M(`reason`),
          onChange: A,
        })),
      (t[34] = A),
      (t[35] = M),
      (t[36] = V))
    : (V = t[36]);
  let H;
  t[37] !== w.Field || t[38] !== V
    ? ((H = (0, $.jsx)(w.Field, { name: `reason`, children: V })),
      (t[37] = w.Field),
      (t[38] = V),
      (t[39] = H))
    : (H = t[39]);
  let U;
  t[40] === y.error
    ? (U = t[41])
    : ((U =
        y.error &&
        !K(y.error, ...ie) &&
        (0, $.jsxs)(m, {
          variant: `destructive`,
          children: [
            (0, $.jsx)(_, { "aria-hidden": !0 }),
            (0, $.jsx)(f, { children: te(y.error) }),
          ],
        })),
      (t[40] = y.error),
      (t[41] = U));
  let W;
  t[42] !== I || t[43] !== z || t[44] !== B || t[45] !== H || t[46] !== U
    ? ((W = (0, $.jsxs)(g, { children: [I, z, B, H, U] })),
      (t[42] = I),
      (t[43] = z),
      (t[44] = B),
      (t[45] = H),
      (t[46] = U),
      (t[47] = W))
    : (W = t[47]);
  let G;
  t[48] === o
    ? (G = t[49])
    : ((G =
        !o &&
        (0, $.jsx)(`p`, {
          id: ze,
          className: `text-sm text-muted-foreground`,
          children: `You're offline. Reconnect to save this price.`,
        })),
      (t[48] = o),
      (t[49] = G));
  let q;
  t[50] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((q = (0, $.jsx)(ue, {
        asChild: !0,
        children: (0, $.jsx)(a, { type: `button`, variant: `outline`, children: `Cancel` }),
      })),
      (t[50] = q))
    : (q = t[50]);
  let J = !o || y.isPending,
    le = o ? void 0 : ze,
    Y;
  t[51] !== r || t[52] !== y.isPending
    ? ((Y = y.isPending
        ? `Saving…`
        : (0, $.jsxs)($.Fragment, {
            children: [Be[r].title, (0, $.jsxs)(re, { "aria-hidden": !0, children: [oe, ` ↵`] })],
          })),
      (t[51] = r),
      (t[52] = y.isPending),
      (t[53] = Y))
    : (Y = t[53]);
  let X;
  t[54] !== J || t[55] !== le || t[56] !== Y
    ? ((X = (0, $.jsxs)(ce, {
        children: [
          q,
          (0, $.jsx)(a, { type: `submit`, disabled: J, "aria-describedby": le, children: Y }),
        ],
      })),
      (t[54] = J),
      (t[55] = le),
      (t[56] = Y),
      (t[57] = X))
    : (X = t[57]);
  let Z;
  return (
    t[58] !== O || t[59] !== P || t[60] !== W || t[61] !== G || t[62] !== X
      ? ((Z = (0, $.jsxs)(`form`, {
          ref: O,
          noValidate: !0,
          className: `flex flex-col gap-6`,
          onSubmit: P,
          children: [W, G, X],
        })),
        (t[58] = O),
        (t[59] = P),
        (t[60] = W),
        (t[61] = G),
        (t[62] = X),
        (t[63] = Z))
      : (Z = t[63]),
    Z
  );
}
function Ue(e) {
  return { value: e.id, label: e.name };
}
function We(e) {
  let t = (0, Q.c)(19),
    { price: n, scope: r } = e,
    i;
  t[0] === r
    ? (i = t[1])
    : ((i = (0, $.jsx)(`span`, { className: `font-medium`, children: r })), (t[0] = r), (t[1] = i));
  let a;
  t[2] === n ? (a = t[3]) : ((a = Ge(n)), (t[2] = n), (t[3] = a));
  let o;
  t[4] === a
    ? (o = t[5])
    : ((o = (0, $.jsx)(`span`, { className: `text-sm text-muted-foreground`, children: a })),
      (t[4] = a),
      (t[5] = o));
  let s;
  t[6] === n.reason
    ? (s = t[7])
    : ((s =
        n.reason &&
        (0, $.jsx)(`span`, {
          className: `text-sm wrap-break-word text-muted-foreground`,
          children: n.reason,
        })),
      (t[6] = n.reason),
      (t[7] = s));
  let c;
  t[8] !== i || t[9] !== o || t[10] !== s
    ? ((c = (0, $.jsxs)(`div`, {
        className: `flex min-w-0 flex-1 flex-col gap-0.5`,
        children: [i, o, s],
      })),
      (t[8] = i),
      (t[9] = o),
      (t[10] = s),
      (t[11] = c))
    : (c = t[11]);
  let l;
  t[12] === n.amount ? (l = t[13]) : ((l = w(n.amount)), (t[12] = n.amount), (t[13] = l));
  let u;
  t[14] === l ? (u = t[15]) : ((u = (0, $.jsx)(he, { amount: l })), (t[14] = l), (t[15] = u));
  let d;
  return (
    t[16] !== c || t[17] !== u
      ? ((d = (0, $.jsxs)(`li`, {
          className: `flex items-start gap-4 px-4 py-3`,
          children: [c, u],
        })),
        (t[16] = c),
        (t[17] = u),
        (t[18] = d))
      : (d = t[18]),
    d
  );
}
function Ge({ validFrom: e, validTo: t }) {
  return t ? `${_e(e)} to ${_e(t)}` : `From ${ye(e)}`;
}
var Ke = 3e4;
function qe(e) {
  let t = (0, Q.c)(58),
    { product: n, fetchedAt: r, setPriceRef: i, onSetPrice: o, onSchedule: c } = e,
    l;
  t[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((l = R()), (t[0] = l)) : (l = t[0]);
  let { data: u } = s(l),
    d = ge(Ke),
    f;
  t[1] === u
    ? (f = t[2])
    : ((f = (e) =>
        e.branchId ? (u?.find((t) => t.id === e.branchId)?.name ?? `Branch`) : `All branches`),
      (t[1] = u),
      (t[2] = f));
  let p = f,
    m,
    h,
    g,
    _,
    v,
    y,
    b,
    x,
    S,
    C,
    T,
    E;
  if (t[3] !== r || t[4] !== d || t[5] !== c || t[6] !== o || t[7] !== n.prices || t[8] !== i) {
    let {
      current: e,
      overrides: s,
      returning: l,
      upcoming: u,
      history: f,
    } = ve(n.prices, Math.max(d, r));
    ((_ = s),
      (v = l),
      (E = u),
      (g = f),
      (h = ee),
      (S = `region`),
      (C = `prices-title`),
      t[21] === Symbol.for(`react.memo_cache_sentinel`)
        ? ((T = (0, $.jsxs)(P, {
            children: [
              (0, $.jsx)(J, {
                id: `prices-title`,
                role: `heading`,
                "aria-level": 2,
                children: `Prices`,
              }),
              (0, $.jsx)(A, { children: `Every price change is kept with its date and reason.` }),
            ],
          })),
          (t[21] = T))
        : (T = t[21]),
      (m = O),
      (y = `flex flex-col gap-6`));
    let p;
    t[22] === Symbol.for(`react.memo_cache_sentinel`)
      ? ((p = (0, $.jsx)(re, { "aria-hidden": !0, children: `P` })), (t[22] = p))
      : (p = t[22]);
    let D;
    t[23] !== o || t[24] !== i
      ? ((D = (0, $.jsxs)(a, {
          ref: i,
          type: `button`,
          variant: `outline`,
          onClick: o,
          children: [`Set price`, p],
        })),
        (t[23] = o),
        (t[24] = i),
        (t[25] = D))
      : (D = t[25]);
    let k;
    (t[26] === c
      ? (k = t[27])
      : ((k = (0, $.jsx)(a, {
          type: `button`,
          variant: `outline`,
          onClick: c,
          children: `Schedule price`,
        })),
        (t[26] = c),
        (t[27] = k)),
      t[28] !== D || t[29] !== k
        ? ((b = (0, $.jsxs)(`div`, { className: `flex flex-wrap gap-2`, children: [D, k] })),
          (t[28] = D),
          (t[29] = k),
          (t[30] = b))
        : (b = t[30]),
      (x = e
        ? (0, $.jsxs)(`div`, {
            className: `flex flex-col gap-1`,
            children: [
              (0, $.jsx)(he, {
                amount: w(e.amount),
                className: `text-left text-3xl font-semibold tracking-tight`,
              }),
              (0, $.jsxs)(`p`, {
                className: `text-sm text-muted-foreground`,
                children: [
                  `All branches, since `,
                  ye(e.validFrom),
                  e.validTo && `, until ${_e(e.validTo)}`,
                ],
              }),
              e.reason &&
                (0, $.jsx)(`p`, { className: `text-sm text-muted-foreground`, children: e.reason }),
            ],
          })
        : (0, $.jsx)(Je, { hasOverrides: _.length > 0 })),
      (t[3] = r),
      (t[4] = d),
      (t[5] = c),
      (t[6] = o),
      (t[7] = n.prices),
      (t[8] = i),
      (t[9] = m),
      (t[10] = h),
      (t[11] = g),
      (t[12] = _),
      (t[13] = v),
      (t[14] = y),
      (t[15] = b),
      (t[16] = x),
      (t[17] = S),
      (t[18] = C),
      (t[19] = T),
      (t[20] = E));
  } else
    ((m = t[9]),
      (h = t[10]),
      (g = t[11]),
      (_ = t[12]),
      (v = t[13]),
      (y = t[14]),
      (b = t[15]),
      (x = t[16]),
      (S = t[17]),
      (C = t[18]),
      (T = t[19]),
      (E = t[20]));
  let D;
  t[31] !== _ || t[32] !== p
    ? ((D = (0, $.jsx)(Ye, { title: `Branch prices`, prices: _, scopeOf: p })),
      (t[31] = _),
      (t[32] = p),
      (t[33] = D))
    : (D = t[33]);
  let k;
  t[34] !== p || t[35] !== E
    ? ((k = (0, $.jsx)(Ye, { title: `Upcoming`, prices: E, scopeOf: p })),
      (t[34] = p),
      (t[35] = E),
      (t[36] = k))
    : (k = t[36]);
  let j;
  t[37] !== v || t[38] !== p
    ? ((j = (0, $.jsx)(Ye, { title: `Returns after the window`, prices: v, scopeOf: p })),
      (t[37] = v),
      (t[38] = p),
      (t[39] = j))
    : (j = t[39]);
  let M;
  t[40] !== g || t[41] !== p
    ? ((M = (0, $.jsx)(Ye, { title: `History`, prices: g, scopeOf: p })),
      (t[40] = g),
      (t[41] = p),
      (t[42] = M))
    : (M = t[42]);
  let N;
  t[43] !== m ||
  t[44] !== k ||
  t[45] !== j ||
  t[46] !== M ||
  t[47] !== y ||
  t[48] !== b ||
  t[49] !== x ||
  t[50] !== D
    ? ((N = (0, $.jsxs)(m, { className: y, children: [b, x, D, k, j, M] })),
      (t[43] = m),
      (t[44] = k),
      (t[45] = j),
      (t[46] = M),
      (t[47] = y),
      (t[48] = b),
      (t[49] = x),
      (t[50] = D),
      (t[51] = N))
    : (N = t[51]);
  let F;
  return (
    t[52] !== h || t[53] !== N || t[54] !== S || t[55] !== C || t[56] !== T
      ? ((F = (0, $.jsxs)(h, { role: S, "aria-labelledby": C, children: [T, N] })),
        (t[52] = h),
        (t[53] = N),
        (t[54] = S),
        (t[55] = C),
        (t[56] = T),
        (t[57] = F))
      : (F = t[57]),
    F
  );
}
function Je(e) {
  let t = (0, Q.c)(4),
    { hasOverrides: n } = e,
    r,
    i;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((r = (0, $.jsx)(M, { variant: `icon`, children: (0, $.jsx)(Ce, { "aria-hidden": !0 }) })),
      (i = (0, $.jsx)(N, { children: `No price yet` })),
      (t[0] = r),
      (t[1] = i))
    : ((r = t[0]), (i = t[1]));
  let a = n
      ? `Only some branches have a price. Set one for all branches.`
      : `Set a price so this product can be sold.`,
    o;
  return (
    t[2] === a
      ? (o = t[3])
      : ((o = (0, $.jsx)(H, {
          className: `border`,
          children: (0, $.jsxs)(V, { children: [r, i, (0, $.jsx)(T, { children: a })] }),
        })),
        (t[2] = a),
        (t[3] = o)),
    o
  );
}
function Ye(e) {
  let t = (0, Q.c)(12),
    { title: n, prices: r, scopeOf: i } = e;
  if (r.length === 0) return null;
  let a;
  t[0] === n
    ? (a = t[1])
    : ((a = (0, $.jsx)(`h3`, { className: `text-sm font-medium`, children: n })),
      (t[0] = n),
      (t[1] = a));
  let o;
  if (t[2] !== r || t[3] !== i) {
    let e;
    (t[5] === i
      ? (e = t[6])
      : ((e = (e) => (0, $.jsx)(We, { price: e, scope: i(e) }, e.id)), (t[5] = i), (t[6] = e)),
      (o = r.map(e)),
      (t[2] = r),
      (t[3] = i),
      (t[4] = o));
  } else o = t[4];
  let s;
  t[7] === o
    ? (s = t[8])
    : ((s = (0, $.jsx)(`ul`, { className: `divide-y rounded-lg border`, children: o })),
      (t[7] = o),
      (t[8] = s));
  let c;
  return (
    t[9] !== a || t[10] !== s
      ? ((c = (0, $.jsxs)(`section`, { className: `flex flex-col gap-2`, children: [a, s] })),
        (t[9] = a),
        (t[10] = s),
        (t[11] = c))
      : (c = t[11]),
    c
  );
}
function Xe(e) {
  let t = (0, Q.c)(7),
    n;
  t[0] === e.save
    ? (n = t[1])
    : ((n = e.save && { "Mod+Enter": e.save, "Mod+S": e.save }), (t[0] = e.save), (t[1] = n));
  let r;
  t[2] === e.setPrice
    ? (r = t[3])
    : ((r = e.setPrice && { P: e.setPrice }), (t[2] = e.setPrice), (t[3] = r));
  let i;
  return (
    t[4] !== n || t[5] !== r
      ? ((i = { ...n, ...r }), (t[4] = n), (t[5] = r), (t[6] = i))
      : (i = t[6]),
    ae(i)
  );
}
function Ze() {
  let e = (0, Q.c)(33),
    t;
  e[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((t = { from: `/_shop/products/$productId` }), (e[0] = t))
    : (t = e[0]);
  let { productId: n } = k(t),
    r;
  e[1] === n ? (r = e[2]) : ((r = z(n)), (e[1] = n), (e[2] = r));
  let { data: i, dataUpdatedAt: s } = c(r),
    l;
  e[3] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((l = { mode: `set`, open: !1 }), (e[3] = l))
    : (l = e[3]);
  let [u, f] = (0, Ee.useState)(l),
    p = (0, Ee.useRef)(null),
    m = (0, Ee.useRef)(null),
    h = (0, Ee.useRef)(null),
    g;
  e[4] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((g = (e) => {
        ((h.current = document.activeElement), f({ mode: e, open: !0 }));
      }),
      (e[4] = g))
    : (g = e[4]);
  let _ = g,
    v;
  e[5] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((v = () => {
        let e = h.current;
        (e instanceof HTMLElement && e.isConnected && e !== document.body ? e : m.current)?.focus();
      }),
      (e[5] = v))
    : (v = e[5]);
  let y = v,
    b;
  e[6] === u.open
    ? (b = e[7])
    : ((b = u.open ? {} : { save: () => p.current?.requestSubmit(), setPrice: () => _(`set`) }),
      (e[6] = u.open),
      (e[7] = b));
  let x = Xe(b),
    S;
  e[8] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((S = (0, $.jsx)(a, {
        asChild: !0,
        variant: `ghost`,
        size: `sm`,
        className: `-ml-3 self-start text-muted-foreground`,
        children: (0, $.jsxs)(o, {
          to: `/products`,
          children: [(0, $.jsx)(xe, { "aria-hidden": !0 }), `Back to products`],
        }),
      })),
      (e[8] = S))
    : (S = e[8]);
  let C;
  e[9] === i.name
    ? (C = e[10])
    : ((C = (0, $.jsxs)(`div`, {
        className: `flex flex-col gap-3`,
        children: [
          S,
          (0, $.jsx)(`h1`, {
            tabIndex: -1,
            ref: d,
            className: `text-3xl font-bold tracking-tight wrap-break-word outline-none`,
            children: i.name,
          }),
        ],
      })),
      (e[9] = i.name),
      (e[10] = C));
  let w;
  e[11] === i
    ? (w = e[12])
    : ((w = (0, $.jsxs)(`div`, {
        className: `flex flex-col gap-6`,
        children: [
          (0, $.jsx)(Pe, { product: i, formRef: p }, i.id),
          (0, $.jsx)(ke, { product: i }),
        ],
      })),
      (e[11] = i),
      (e[12] = w));
  let T, E;
  e[13] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((E = () => _(`set`)), (T = () => _(`schedule`)), (e[13] = T), (e[14] = E))
    : ((T = e[13]), (E = e[14]));
  let D;
  e[15] !== s || e[16] !== i
    ? ((D = (0, $.jsx)(qe, {
        product: i,
        fetchedAt: s,
        setPriceRef: m,
        onSetPrice: E,
        onSchedule: T,
      })),
      (e[15] = s),
      (e[16] = i),
      (e[17] = D))
    : (D = e[17]);
  let O;
  e[18] !== D || e[19] !== w
    ? ((O = (0, $.jsxs)(`div`, {
        className: `grid items-start gap-6 lg:grid-cols-2`,
        children: [w, D],
      })),
      (e[18] = D),
      (e[19] = w),
      (e[20] = O))
    : (O = e[20]);
  let A;
  e[21] === u ? (A = e[22]) : ((A = (e) => f({ ...u, open: e })), (e[21] = u), (e[22] = A));
  let j;
  e[23] !== u.mode || e[24] !== u.open || e[25] !== i.id || e[26] !== A
    ? ((j = (0, $.jsx)(Ve, {
        productId: i.id,
        mode: u.mode,
        open: u.open,
        onOpenChange: A,
        restoreFocus: y,
      })),
      (e[23] = u.mode),
      (e[24] = u.open),
      (e[25] = i.id),
      (e[26] = A),
      (e[27] = j))
    : (j = e[27]);
  let M;
  return (
    e[28] !== x || e[29] !== O || e[30] !== j || e[31] !== C
      ? ((M = (0, $.jsxs)(`div`, {
          ref: x,
          className: `flex flex-col gap-6`,
          children: [C, O, j],
        })),
        (e[28] = x),
        (e[29] = O),
        (e[30] = j),
        (e[31] = C),
        (e[32] = M))
      : (M = e[32]),
    M
  );
}
export { Ze as ProductScreen };
