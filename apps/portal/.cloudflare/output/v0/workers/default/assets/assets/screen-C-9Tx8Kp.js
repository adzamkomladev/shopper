import { Bt as e, Ht as t, Wt as n, _ as r, u as i } from "./createLucideIcon-BBeoGZx-.js";
import { n as a, t as o } from "./link-BaidU34I.js";
import { i as s, n as c, o as l, r as u, s as d } from "./queryOptions-BmBcu1YJ.js";
import { t as f } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as p, t as m } from "./text-BG7k3Olz.js";
import { t as h } from "./data-X9pOYu-7.js";
import { n as g, r as _, t as v } from "./alert-BTZapdK4.js";
import { a as y, i as b, n as x, o as S, r as C, t as w } from "./select-DV5qMU7p.js";
import { a as T, d as E, o as D, t as O } from "./field-BUpdDBSZ.js";
import { d as k } from "./popover-CyW2k5kD.js";
import { i as A } from "./schemas-CMFvL3XH.js";
import { i as ee, n as te, r as ne, t as re } from "./catalogue-Dr7V8kpe.js";
import {
  Ut as j,
  Wt as M,
  at as N,
  et as P,
  it as F,
  ot as I,
  rt as ie,
  st as L,
  tt as R,
} from "./index-DZbZvBMN.js";
import { i as ae, n as oe, t as se } from "./online-B_7Uj1Wv.js";
import { a as ce, i as z, n as le, o as B, r as V, s as H, t as U } from "./sheet-rEE2xq8n.js";
import { n as W, r as ue, t as G } from "./options-C9HrHlKt.js";
import { t as de } from "./money-C9BcWvGa.js";
import { t as K } from "./badge-Dxtl8kcr.js";
import { i as fe, n as pe, r as q, t as me } from "./callback-Bk8_3X5T.js";
var J = class extends s {
  constructor(e, t) {
    super(e, t);
  }
  bindMethods() {
    (super.bindMethods(),
      (this.fetchNextPage = this.fetchNextPage.bind(this)),
      (this.fetchPreviousPage = this.fetchPreviousPage.bind(this)));
  }
  setOptions(e) {
    ((e._type = `infinite`), super.setOptions(e));
  }
  getOptimisticResult(e) {
    return ((e._type = `infinite`), super.getOptimisticResult(e));
  }
  fetchNextPage(e) {
    return this.fetch({ ...e, meta: { fetchMore: { direction: `forward` } } });
  }
  fetchPreviousPage(e) {
    return this.fetch({ ...e, meta: { fetchMore: { direction: `backward` } } });
  }
  createResult(e, t) {
    let { state: n } = e,
      r = super.createResult(e, t),
      { isFetching: i, isRefetching: a, isError: o, isRefetchError: s } = r,
      c = n.fetchMeta?.fetchMore?.direction,
      u = o && c === `forward`,
      f = i && c === `forward`,
      p = o && c === `backward`,
      m = i && c === `backward`;
    return {
      ...r,
      fetchNextPage: this.fetchNextPage,
      fetchPreviousPage: this.fetchPreviousPage,
      hasNextPage: l(t, n.data),
      hasPreviousPage: d(t, n.data),
      isFetchNextPageError: u,
      isFetchingNextPage: f,
      isFetchPreviousPageError: p,
      isFetchingPreviousPage: m,
      isRefetchError: s && !u && !p,
      isRefetching: a && !f && !m,
    };
  }
};
function he(e, t) {
  return c({ ...e, enabled: !0, suspense: !0, throwOnError: u, placeholderData: void 0 }, J, t);
}
function ge(e, t) {
  return c(e, J, t);
}
var Y = n(t(), 1),
  X = r(),
  Z = e(),
  _e = `save-offline-note`;
function ve(e) {
  let t = (0, X.c)(64),
    { onCreated: n } = e,
    r = se(),
    a = ie(n),
    o;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((o = { onSubmit: ee }), (t[0] = o))
    : (o = t[0]);
  let s;
  t[1] === a
    ? (s = t[2])
    : ((s = {
        defaultValues: re,
        validators: o,
        onSubmit: (e) => {
          let { value: t } = e;
          return a.mutate(t);
        },
        onSubmitInvalid: _,
      }),
      (t[1] = a),
      (t[2] = s));
  let c = p(s),
    l;
  t[3] !== a.isPending || t[4] !== c || t[5] !== r
    ? ((l = {
        "Mod+Enter": () => {
          r && !a.isPending && c.handleSubmit();
        },
      }),
      (t[3] = a.isPending),
      (t[4] = c),
      (t[5] = r),
      (t[6] = l))
    : (l = t[6]);
  let u = ae(l),
    d;
  t[7] === a
    ? (d = t[8])
    : ((d = () => {
        a.isError && a.reset();
      }),
      (t[7] = a),
      (t[8] = d));
  let f = d,
    h;
  t[9] === a.error ? (h = t[10]) : ((h = te(a.error)), (t[9] = a.error), (t[10] = h));
  let y = h,
    b;
  t[11] !== a.error || t[12] !== y
    ? ((b = (e) => (y === e && a.error ? ne(a.error) : void 0)),
      (t[11] = a.error),
      (t[12] = y),
      (t[13] = b))
    : (b = t[13]);
  let x = b,
    S;
  t[14] === c
    ? (S = t[15])
    : ((S = (e) => {
        (e.preventDefault(), c.handleSubmit());
      }),
      (t[14] = c),
      (t[15] = S));
  let C;
  t[16] !== f || t[17] !== x
    ? ((C = (e) =>
        (0, Z.jsx)(m, {
          field: e,
          label: `Name`,
          autoFocus: !0,
          autoComplete: `off`,
          serverError: x(`name`),
          onChange: f,
        })),
      (t[16] = f),
      (t[17] = x),
      (t[18] = C))
    : (C = t[18]);
  let w;
  t[19] !== c.Field || t[20] !== C
    ? ((w = (0, Z.jsx)(c.Field, { name: `name`, children: C })),
      (t[19] = c.Field),
      (t[20] = C),
      (t[21] = w))
    : (w = t[21]);
  let D;
  t[22] !== f || t[23] !== x
    ? ((D = (e) =>
        (0, Z.jsx)(m, {
          field: e,
          label: `SKU`,
          autoComplete: `off`,
          autoCapitalize: `characters`,
          spellCheck: !1,
          serverError: x(`sku`),
          onChange: f,
        })),
      (t[22] = f),
      (t[23] = x),
      (t[24] = D))
    : (D = t[24]);
  let O;
  t[25] !== c.Field || t[26] !== D
    ? ((O = (0, Z.jsx)(c.Field, { name: `sku`, children: D })),
      (t[25] = c.Field),
      (t[26] = D),
      (t[27] = O))
    : (O = t[27]);
  let k, A, j;
  t[28] === c.Field
    ? ((k = t[29]), (A = t[30]), (j = t[31]))
    : ((k = (0, Z.jsx)(c.Field, { name: `baseUnit`, children: xe })),
      (A = (0, Z.jsx)(c.Field, { name: `taxClass`, children: be })),
      (j = (0, Z.jsx)(c.Field, { name: `categoryId`, children: ye })),
      (t[28] = c.Field),
      (t[29] = k),
      (t[30] = A),
      (t[31] = j));
  let M;
  t[32] !== f || t[33] !== x
    ? ((M = (e) =>
        (0, Z.jsx)(m, {
          field: e,
          label: `Barcode`,
          description: `Optional. Scan it or type the code.`,
          autoComplete: `off`,
          inputMode: `numeric`,
          serverError: x(`barcode`),
          onChange: f,
        })),
      (t[32] = f),
      (t[33] = x),
      (t[34] = M))
    : (M = t[34]);
  let N;
  t[35] !== c.Field || t[36] !== M
    ? ((N = (0, Z.jsx)(c.Field, { name: `barcode`, children: M })),
      (t[35] = c.Field),
      (t[36] = M),
      (t[37] = N))
    : (N = t[37]);
  let P;
  t[38] !== a.error || t[39] !== y
    ? ((P =
        a.error &&
        !y &&
        (0, Z.jsxs)(v, {
          variant: `destructive`,
          children: [
            (0, Z.jsx)(E, { "aria-hidden": !0 }),
            (0, Z.jsx)(g, { children: a.error.message }),
          ],
        })),
      (t[38] = a.error),
      (t[39] = y),
      (t[40] = P))
    : (P = t[40]);
  let F;
  t[41] !== O ||
  t[42] !== k ||
  t[43] !== A ||
  t[44] !== j ||
  t[45] !== N ||
  t[46] !== P ||
  t[47] !== w
    ? ((F = (0, Z.jsxs)(T, {
        className: `flex-1 overflow-y-auto px-4`,
        children: [w, O, k, A, j, N, P],
      })),
      (t[41] = O),
      (t[42] = k),
      (t[43] = A),
      (t[44] = j),
      (t[45] = N),
      (t[46] = P),
      (t[47] = w),
      (t[48] = F))
    : (F = t[48]);
  let I;
  t[49] === r
    ? (I = t[50])
    : ((I =
        !r &&
        (0, Z.jsx)(`p`, {
          id: _e,
          className: `px-4 text-sm text-muted-foreground`,
          children: `You're offline. Reconnect to save this product.`,
        })),
      (t[49] = r),
      (t[50] = I));
  let R;
  t[51] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((R = (0, Z.jsx)(le, {
        asChild: !0,
        children: (0, Z.jsx)(i, { type: `button`, variant: `outline`, children: `Cancel` }),
      })),
      (t[51] = R))
    : (R = t[51]);
  let z = !r || a.isPending,
    B = r ? void 0 : _e,
    V;
  t[52] === a.isPending
    ? (V = t[53])
    : ((V = a.isPending
        ? `Saving…`
        : (0, Z.jsxs)(Z.Fragment, {
            children: [`Save product`, (0, Z.jsxs)(L, { "aria-hidden": !0, children: [oe, ` ↵`] })],
          })),
      (t[52] = a.isPending),
      (t[53] = V));
  let H;
  t[54] !== z || t[55] !== B || t[56] !== V
    ? ((H = (0, Z.jsxs)(ce, {
        className: `flex-col-reverse sm:flex-row sm:justify-end`,
        children: [
          R,
          (0, Z.jsx)(i, { type: `submit`, disabled: z, "aria-describedby": B, children: V }),
        ],
      })),
      (t[54] = z),
      (t[55] = B),
      (t[56] = V),
      (t[57] = H))
    : (H = t[57]);
  let U;
  return (
    t[58] !== u || t[59] !== F || t[60] !== I || t[61] !== H || t[62] !== S
      ? ((U = (0, Z.jsxs)(`form`, {
          ref: u,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: S,
          children: [F, I, H],
        })),
        (t[58] = u),
        (t[59] = F),
        (t[60] = I),
        (t[61] = H),
        (t[62] = S),
        (t[63] = U))
      : (U = t[63]),
    U
  );
}
function ye(e) {
  return (0, Z.jsxs)(O, {
    children: [
      (0, Z.jsx)(D, { htmlFor: e.name, children: `Category` }),
      (0, Z.jsx)(ue, { id: e.name, value: e.state.value ?? null, onChange: e.handleChange }),
    ],
  });
}
function be(e) {
  return (0, Z.jsx)(w, { field: e, label: `Tax class`, options: G });
}
function xe(e) {
  return (0, Z.jsx)(w, { field: e, label: `Unit`, options: W });
}
function Se(e) {
  let t = (0, X.c)(12),
    { open: n, onOpenChange: r, addRef: i } = e,
    a;
  t[0] === i
    ? (a = t[1])
    : ((a = (e) => {
        (e.preventDefault(), i.current?.focus());
      }),
      (t[0] = i),
      (t[1] = a));
  let o;
  t[2] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((o = (0, Z.jsxs)(B, {
        children: [
          (0, Z.jsx)(H, { children: `New product` }),
          (0, Z.jsx)(z, { children: `Add the basics now. You can set prices next.` }),
        ],
      })),
      (t[2] = o))
    : (o = t[2]);
  let s;
  t[3] === r
    ? (s = t[4])
    : ((s = (0, Z.jsx)(ve, { onCreated: () => r(!1) })), (t[3] = r), (t[4] = s));
  let c;
  t[5] !== a || t[6] !== s
    ? ((c = (0, Z.jsxs)(V, { className: `sm:max-w-md`, onCloseAutoFocus: a, children: [o, s] })),
      (t[5] = a),
      (t[6] = s),
      (t[7] = c))
    : (c = t[7]);
  let l;
  return (
    t[8] !== r || t[9] !== n || t[10] !== c
      ? ((l = (0, Z.jsx)(U, { open: n, onOpenChange: r, children: c })),
        (t[8] = r),
        (t[9] = n),
        (t[10] = c),
        (t[11] = l))
      : (l = t[11]),
    l
  );
}
var Q = `hidden md:table-cell`;
function Ce(e) {
  let t = (0, X.c)(19),
    { products: n, categories: r, onEndReached: i } = e,
    a;
  t[0] === r ? (a = t[1]) : ((a = new Map(r.map(ke))), (t[0] = r), (t[1] = a));
  let s = a,
    c;
  t[2] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = { className: `whitespace-normal` }), (t[2] = c))
    : (c = t[2]);
  let l;
  t[3] === s
    ? (l = t[4])
    : ((l = {
        id: `product`,
        header: `Product`,
        meta: c,
        cell: (e) => {
          let { row: t } = e;
          return (0, Z.jsxs)(`div`, {
            className: `flex flex-col`,
            children: [
              (0, Z.jsx)(o, {
                to: `/products/$productId`,
                params: { productId: t.original.id },
                className: `w-fit font-medium hover:underline`,
                children: t.original.name,
              }),
              (0, Z.jsx)(`span`, {
                className: `text-xs text-muted-foreground`,
                children: t.original.sku,
              }),
              (0, Z.jsxs)(`span`, {
                className: `text-xs text-muted-foreground md:hidden`,
                children: [
                  je(t.original),
                  ` ·`,
                  ` `,
                  s.get(t.original.categoryId ?? ``) ?? `No category`,
                ],
              }),
            ],
          });
        },
      }),
      (t[3] = s),
      (t[4] = l));
  let u;
  t[5] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((u = { className: Q }), (t[5] = u))
    : (u = t[5]);
  let d;
  t[6] === s
    ? (d = t[7])
    : ((d = {
        id: `category`,
        header: `Category`,
        meta: u,
        cell: (e) => {
          let { row: t } = e;
          return s.get(t.original.categoryId ?? ``) ?? (0, Z.jsx)(Ae, { children: `No category` });
        },
      }),
      (t[6] = s),
      (t[7] = d));
  let f;
  t[8] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((f = { id: `unit`, header: `Unit`, meta: { className: Q }, cell: Oe }), (t[8] = f))
    : (f = t[8]);
  let p;
  t[9] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((p = { id: `price`, header: `Price`, meta: { align: `right` }, cell: De }), (t[9] = p))
    : (p = t[9]);
  let m;
  t[10] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((m = { id: `tax`, header: `Tax class`, meta: { className: Q }, cell: Ee }), (t[10] = m))
    : (m = t[10]);
  let g;
  t[11] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((g = { id: `online`, header: `Online`, meta: { className: Q }, cell: Te }), (t[11] = g))
    : (g = t[11]);
  let _;
  t[12] !== l || t[13] !== d
    ? ((_ = [l, d, f, p, m, g]), (t[12] = l), (t[13] = d), (t[14] = _))
    : (_ = t[14]);
  let v = _,
    y;
  return (
    t[15] !== v || t[16] !== i || t[17] !== n
      ? ((y = (0, Z.jsx)(h, {
          label: `Products`,
          columns: v,
          data: n,
          getRowId: we,
          onEndReached: i,
          className: `min-h-0`,
        })),
        (t[15] = v),
        (t[16] = i),
        (t[17] = n),
        (t[18] = y))
      : (y = t[18]),
    y
  );
}
function we(e) {
  return e.id;
}
function Te(e) {
  let { row: t } = e;
  return (0, Z.jsx)(K, {
    variant: t.original.onlineVisible ? `default` : `outline`,
    children: t.original.onlineVisible ? `Online` : `Store only`,
  });
}
function Ee(e) {
  let { row: t } = e;
  return (0, Z.jsx)(K, {
    variant: `secondary`,
    children: G.find((e) => e.value === t.original.taxClass)?.label,
  });
}
function De(e) {
  let { row: t } = e;
  return t.original.price === null
    ? (0, Z.jsx)(Ae, { children: `No price` })
    : (0, Z.jsx)(de, { amount: A(t.original.price), className: `font-medium` });
}
function Oe(e) {
  let { row: t } = e;
  return je(t.original);
}
function ke(e) {
  return [e.id, e.name];
}
function Ae(e) {
  let t = (0, X.c)(2),
    { children: n } = e,
    r;
  return (
    t[0] === n
      ? (r = t[1])
      : ((r = (0, Z.jsx)(`span`, { className: `text-muted-foreground`, children: n })),
        (t[0] = n),
        (t[1] = r)),
    r
  );
}
function je(e) {
  return W.find((t) => t.value === e.baseUnit)?.label;
}
function Me(e) {
  let t = (0, X.c)(31),
    { search: n, categories: r, addRef: a, onAdd: o, onClear: s } = e,
    c;
  t[0] === n ? (c = t[1]) : ((c = R(n)), (t[0] = n), (t[1] = c));
  let l = c,
    {
      data: u,
      hasNextPage: d,
      isFetchingNextPage: f,
      isFetchNextPageError: p,
      fetchNextPage: m,
    } = he(l),
    h;
  t[2] === u.pages ? (h = t[3]) : ((h = u.pages.flatMap(Ne)), (t[2] = u.pages), (t[3] = h));
  let _ = h;
  if (_.length === 0) {
    let e;
    return (
      t[4] !== a || t[5] !== o || t[6] !== s || t[7] !== n.categoryId || t[8] !== n.q
        ? ((e =
            n.q || n.categoryId
              ? (0, Z.jsx)(N, { query: n.q, onClear: s })
              : (0, Z.jsx)(F, { onAdd: o, addRef: a })),
          (t[4] = a),
          (t[5] = o),
          (t[6] = s),
          (t[7] = n.categoryId),
          (t[8] = n.q),
          (t[9] = e))
        : (e = t[9]),
      e
    );
  }
  let y;
  t[10] === l.queryKey
    ? (y = t[11])
    : ((y = l.queryKey.join(`|`)), (t[10] = l.queryKey), (t[11] = y));
  let b;
  t[12] !== m || t[13] !== d || t[14] !== p || t[15] !== f
    ? ((b = () => d && !f && !p && void m()),
      (t[12] = m),
      (t[13] = d),
      (t[14] = p),
      (t[15] = f),
      (t[16] = b))
    : (b = t[16]);
  let x;
  t[17] !== r || t[18] !== _ || t[19] !== y || t[20] !== b
    ? ((x = (0, Z.jsx)(Ce, { products: _, categories: r, onEndReached: b }, y)),
      (t[17] = r),
      (t[18] = _),
      (t[19] = y),
      (t[20] = b),
      (t[21] = x))
    : (x = t[21]);
  let S;
  t[22] !== m || t[23] !== p
    ? ((S =
        p &&
        (0, Z.jsxs)(v, {
          variant: `destructive`,
          className: `flex items-center gap-3`,
          children: [
            (0, Z.jsx)(E, { "aria-hidden": !0 }),
            (0, Z.jsx)(g, { className: `flex-1`, children: `Couldn't load more products.` }),
            (0, Z.jsx)(i, {
              variant: `outline`,
              size: `sm`,
              onClick: () => void m(),
              children: `Retry`,
            }),
          ],
        })),
      (t[22] = m),
      (t[23] = p),
      (t[24] = S))
    : (S = t[24]);
  let C;
  t[25] === f
    ? (C = t[26])
    : ((C =
        f &&
        (0, Z.jsx)(`p`, {
          role: `status`,
          className: `text-center text-sm text-muted-foreground`,
          children: `Loading more products…`,
        })),
      (t[25] = f),
      (t[26] = C));
  let w;
  return (
    t[27] !== x || t[28] !== S || t[29] !== C
      ? ((w = (0, Z.jsxs)(Z.Fragment, { children: [x, S, C] })),
        (t[27] = x),
        (t[28] = S),
        (t[29] = C),
        (t[30] = w))
      : (w = t[30]),
    w
  );
}
function Ne(e) {
  return e.items;
}
var $ = `all`;
function Pe(e) {
  let t = (0, X.c)(17),
    {
      text: n,
      onTextChange: r,
      searchRef: i,
      categories: a,
      categoryId: o,
      onCategoryChange: s,
    } = e,
    c;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = (0, Z.jsx)(q, { children: (0, Z.jsx)(k, { "aria-hidden": !0 }) })), (t[0] = c))
    : (c = t[0]);
  let l;
  t[1] === r ? (l = t[2]) : ((l = (e) => r(e.target.value)), (t[1] = r), (t[2] = l));
  let u;
  t[3] !== i || t[4] !== l || t[5] !== n
    ? ((u = (0, Z.jsx)(fe, {
        ref: i,
        value: n,
        onChange: l,
        placeholder: `Name, SKU or barcode`,
        "aria-label": `Search products`,
      })),
      (t[3] = i),
      (t[4] = l),
      (t[5] = n),
      (t[6] = u))
    : (u = t[6]);
  let d;
  t[7] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((d = (0, Z.jsx)(q, {
        align: `inline-end`,
        children: (0, Z.jsx)(L, { "aria-hidden": !0, children: `/` }),
      })),
      (t[7] = d))
    : (d = t[7]);
  let f;
  t[8] === u
    ? (f = t[9])
    : ((f = (0, Z.jsxs)(pe, { className: `min-w-0 flex-1 basis-64`, children: [c, u, d] })),
      (t[8] = u),
      (t[9] = f));
  let p;
  t[10] !== a || t[11] !== o || t[12] !== s
    ? ((p =
        a.length > 0 &&
        (0, Z.jsxs)(x, {
          value: o ?? $,
          onValueChange: (e) => s(e === $ ? void 0 : e),
          children: [
            (0, Z.jsx)(y, {
              "aria-label": `Filter by category`,
              className: `w-full sm:w-52`,
              children: (0, Z.jsx)(S, {}),
            }),
            (0, Z.jsxs)(C, {
              children: [(0, Z.jsx)(b, { value: $, children: `All categories` }), a.map(Fe)],
            }),
          ],
        })),
      (t[10] = a),
      (t[11] = o),
      (t[12] = s),
      (t[13] = p))
    : (p = t[13]);
  let m;
  return (
    t[14] !== f || t[15] !== p
      ? ((m = (0, Z.jsxs)(`div`, { className: `flex flex-wrap gap-3`, children: [f, p] })),
        (t[14] = f),
        (t[15] = p),
        (t[16] = m))
      : (m = t[16]),
    m
  );
}
function Fe(e) {
  return (0, Z.jsx)(b, { value: e.id, children: e.name }, e.id);
}
var Ie = 250;
function Le(e) {
  let t = (0, X.c)(17),
    n = j(),
    r = a(),
    [i, o] = (0, Y.useState)(e.q ?? ``),
    [s, c] = (0, Y.useState)(e.q);
  e.q !== s && (c(e.q), (e.q ?? ``) !== i.trim() && o(e.q ?? ``));
  let l;
  t[0] === n
    ? (l = t[1])
    : ((l = (e) => n({ to: `/products`, search: (t) => ({ ...t, ...e }), replace: !0 })),
      (t[0] = n),
      (t[1] = l));
  let u = l,
    d;
  t[2] !== r.state.location.pathname || t[3] !== u
    ? ((d = (e) => {
        r.state.location.pathname === `/products` && u({ q: e.trim() || void 0 });
      }),
      (t[2] = r.state.location.pathname),
      (t[3] = u),
      (t[4] = d))
    : (d = t[4]);
  let f = me(d, Ie),
    p;
  t[5] === f
    ? (p = t[6])
    : ((p = (e) => {
        (o(e), f(e));
      }),
      (t[5] = f),
      (t[6] = p));
  let m;
  t[7] === u ? (m = t[8]) : ((m = (e) => void u({ categoryId: e })), (t[7] = u), (t[8] = m));
  let h;
  t[9] !== f || t[10] !== u
    ? ((h = () => {
        (f.cancel(), o(``), u({ q: void 0, categoryId: void 0 }));
      }),
      (t[9] = f),
      (t[10] = u),
      (t[11] = h))
    : (h = t[11]);
  let g;
  return (
    t[12] !== p || t[13] !== m || t[14] !== h || t[15] !== i
      ? ((g = { text: i, onTextChange: p, onCategoryChange: m, clear: h }),
        (t[12] = p),
        (t[13] = m),
        (t[14] = h),
        (t[15] = i),
        (t[16] = g))
      : (g = t[16]),
    g
  );
}
function Re(e) {
  let t = (0, X.c)(3),
    n;
  return (
    t[0] !== e.focusSearch || t[1] !== e.newProduct
      ? ((n = { N: e.newProduct, "/": e.focusSearch }),
        (t[0] = e.focusSearch),
        (t[1] = e.newProduct),
        (t[2] = n))
      : (n = t[2]),
    ae(n)
  );
}
function ze() {
  let e = (0, X.c)(31),
    t;
  e[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((t = { from: `/_shop/products` }), (e[0] = t))
    : (t = e[0]);
  let n = M(t),
    r;
  e[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((r = P()), (e[1] = r)) : (r = e[1]);
  let { data: a } = f(r),
    o;
  e[2] === n ? (o = e[3]) : ((o = R(n)), (e[2] = n), (e[3] = o));
  let { data: s } = ge(o),
    [c, l] = (0, Y.useState)(!1),
    u = (0, Y.useRef)(null),
    d = (0, Y.useRef)(null),
    p = Le(n),
    m;
  e[4] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((m = { newProduct: () => l(!0), focusSearch: () => u.current?.focus() }), (e[4] = m))
    : (m = e[4]);
  let h = Re(m),
    g = !(n.q || n.categoryId) && s?.pages[0]?.items.length === 0,
    _;
  e[5] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((_ = (0, Z.jsx)(`h1`, {
        className: `text-3xl font-bold tracking-tight`,
        children: `Products`,
      })),
      (e[5] = _))
    : (_ = e[5]);
  let v;
  e[6] === g
    ? (v = e[7])
    : ((v =
        !g &&
        (0, Z.jsxs)(i, {
          ref: d,
          onClick: () => l(!0),
          children: [`Add product`, (0, Z.jsx)(L, { "aria-hidden": !0, children: `N` })],
        })),
      (e[6] = g),
      (e[7] = v));
  let y;
  e[8] === v
    ? (y = e[9])
    : ((y = (0, Z.jsxs)(`div`, {
        className: `flex items-center justify-between gap-4`,
        children: [_, v],
      })),
      (e[8] = v),
      (e[9] = y));
  let b;
  e[10] !== a ||
  e[11] !== g ||
  e[12] !== n.categoryId ||
  e[13] !== p.onCategoryChange ||
  e[14] !== p.onTextChange ||
  e[15] !== p.text
    ? ((b =
        !g &&
        (0, Z.jsx)(Pe, {
          text: p.text,
          onTextChange: p.onTextChange,
          onCategoryChange: p.onCategoryChange,
          searchRef: u,
          categories: a,
          categoryId: n.categoryId,
        })),
      (e[10] = a),
      (e[11] = g),
      (e[12] = n.categoryId),
      (e[13] = p.onCategoryChange),
      (e[14] = p.onTextChange),
      (e[15] = p.text),
      (e[16] = b))
    : (b = e[16]);
  let x;
  e[17] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((x = (0, Z.jsx)(I, {})), (e[17] = x))
    : (x = e[17]);
  let S;
  e[18] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((S = () => l(!0)), (e[18] = S))
    : (S = e[18]);
  let C;
  e[19] !== a || e[20] !== n || e[21] !== p.clear
    ? ((C = (0, Z.jsx)(Y.Suspense, {
        fallback: x,
        children: (0, Z.jsx)(Me, {
          search: n,
          categories: a,
          addRef: d,
          onAdd: S,
          onClear: p.clear,
        }),
      })),
      (e[19] = a),
      (e[20] = n),
      (e[21] = p.clear),
      (e[22] = C))
    : (C = e[22]);
  let w;
  e[23] === c
    ? (w = e[24])
    : ((w = (0, Z.jsx)(Se, { open: c, onOpenChange: l, addRef: d })), (e[23] = c), (e[24] = w));
  let T;
  return (
    e[25] !== h || e[26] !== C || e[27] !== w || e[28] !== y || e[29] !== b
      ? ((T = (0, Z.jsxs)(`div`, {
          ref: h,
          className: `flex min-h-0 flex-1 flex-col gap-6`,
          children: [y, b, C, w],
        })),
        (e[25] = h),
        (e[26] = C),
        (e[27] = w),
        (e[28] = y),
        (e[29] = b),
        (e[30] = T))
      : (T = e[30]),
    T
  );
}
export { ze as ProductsScreen };
