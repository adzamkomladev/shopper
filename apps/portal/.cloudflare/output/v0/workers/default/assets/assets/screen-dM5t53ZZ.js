import { Bt as e, Ht as t, Wt as n, _ as r, i, u as a } from "./createLucideIcon-BBeoGZx-.js";
import { t as o } from "./link-BaidU34I.js";
import { t as s } from "./useQuery-DCYgzPRk.js";
import { t as c } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as l, t as u } from "./text-BG7k3Olz.js";
import { t as d } from "./data-X9pOYu-7.js";
import { n as f, r as p, t as m } from "./alert-BTZapdK4.js";
import { t as h } from "./select-DV5qMU7p.js";
import { a as g, d as _ } from "./field-BUpdDBSZ.js";
import { t as v } from "./git-branch-BuF_FEGU.js";
import { t as y } from "./store-BMentYd9.js";
import {
  $ as b,
  A as x,
  L as S,
  M as C,
  N as w,
  Q as T,
  dt as E,
  j as D,
  st as O,
  y as k,
} from "./index-DZbZvBMN.js";
import { i as A, t as j } from "./online-B_7Uj1Wv.js";
import { a as M, i as N, n as P, o as F, r as I, s as L, t as R } from "./panel-CiofwA_P.js";
import { t as z } from "./dialog-D2WADKSD.js";
var ee = n(t(), 1),
  B = r(),
  V = e();
function te(e) {
  let t = (0, B.c)(16),
    { branch: n, open: r, onOpenChange: a, restoreFocus: o } = e,
    s;
  t[0] === a ? (s = t[1]) : ((s = () => a(!1)), (t[0] = a), (t[1] = s));
  let c = x(s),
    l = n?.name ?? `this branch`,
    u = c.error,
    d;
  t[2] !== a || t[3] !== c
    ? ((d = (e) => {
        (e || c.reset(), a(e));
      }),
      (t[2] = a),
      (t[3] = c),
      (t[4] = d))
    : (d = t[4]);
  let f = `Delete ${l}?`,
    p =
      u instanceof i && u.status === 409
        ? `${l} is still used by tills or sales, so it can't be deleted.`
        : u?.message,
    m;
  t[5] !== n || t[6] !== c
    ? ((m = () => n && c.mutate(n)), (t[5] = n), (t[6] = c), (t[7] = m))
    : (m = t[7]);
  let h;
  return (
    t[8] !== r ||
    t[9] !== c.isPending ||
    t[10] !== o ||
    t[11] !== d ||
    t[12] !== f ||
    t[13] !== p ||
    t[14] !== m
      ? ((h = (0, V.jsx)(z, {
          open: r,
          onOpenChange: d,
          title: f,
          description: `This removes the branch. It can't be undone.`,
          confirmLabel: `Delete branch`,
          error: p,
          pending: c.isPending,
          onConfirm: m,
          restoreFocus: o,
        })),
        (t[8] = r),
        (t[9] = c.isPending),
        (t[10] = o),
        (t[11] = d),
        (t[12] = f),
        (t[13] = p),
        (t[14] = m),
        (t[15] = h))
      : (h = t[15]),
    h
  );
}
function ne(e) {
  let t = (0, B.c)(42),
    { branch: n, stores: r, onSaved: i } = e,
    a = j(),
    o = D(n, i),
    s;
  t[0] !== n || t[1] !== r[0] || t[2] !== r.length
    ? ((s = n ? { name: n.name, storeId: n.storeId } : w(r.length === 1 ? r[0].id : ``)),
      (t[0] = n),
      (t[1] = r[0]),
      (t[2] = r.length),
      (t[3] = s))
    : (s = t[3]);
  let c;
  t[4] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = { onSubmit: C }), (t[4] = c))
    : (c = t[4]);
  let d;
  t[5] === o
    ? (d = t[6])
    : ((d = (e) => {
        let { value: t } = e;
        return o.mutate(t);
      }),
      (t[5] = o),
      (t[6] = d));
  let v;
  t[7] !== s || t[8] !== d
    ? ((v = { defaultValues: s, validators: c, onSubmit: d, onSubmitInvalid: p }),
      (t[7] = s),
      (t[8] = d),
      (t[9] = v))
    : (v = t[9]);
  let y = l(v),
    b;
  t[10] !== y || t[11] !== a || t[12] !== o.isPending
    ? ((b = {
        "Mod+Enter": () => {
          a && !o.isPending && y.handleSubmit();
        },
      }),
      (t[10] = y),
      (t[11] = a),
      (t[12] = o.isPending),
      (t[13] = b))
    : (b = t[13]);
  let x = A(b),
    S;
  t[14] === o
    ? (S = t[15])
    : ((S = () => {
        o.isError && o.reset();
      }),
      (t[14] = o),
      (t[15] = S));
  let T = S,
    E;
  t[16] === y
    ? (E = t[17])
    : ((E = (e) => {
        (e.preventDefault(), y.handleSubmit());
      }),
      (t[16] = y),
      (t[17] = E));
  let O;
  t[18] === T
    ? (O = t[19])
    : ((O = (e) =>
        (0, V.jsx)(u, {
          field: e,
          label: `Name`,
          autoFocus: !0,
          autoComplete: `off`,
          onChange: T,
        })),
      (t[18] = T),
      (t[19] = O));
  let k;
  t[20] !== y.Field || t[21] !== O
    ? ((k = (0, V.jsx)(y.Field, { name: `name`, children: O })),
      (t[20] = y.Field),
      (t[21] = O),
      (t[22] = k))
    : (k = t[22]);
  let M;
  t[23] === r
    ? (M = t[24])
    : ((M = (e) =>
        (0, V.jsx)(h, {
          field: e,
          label: `Store`,
          placeholder: `Choose a store`,
          options: r.map(H),
        })),
      (t[23] = r),
      (t[24] = M));
  let N;
  t[25] !== y.Field || t[26] !== M
    ? ((N = (0, V.jsx)(y.Field, { name: `storeId`, children: M })),
      (t[25] = y.Field),
      (t[26] = M),
      (t[27] = N))
    : (N = t[27]);
  let P;
  t[28] === o.error
    ? (P = t[29])
    : ((P =
        o.error &&
        (0, V.jsxs)(m, {
          variant: `destructive`,
          children: [
            (0, V.jsx)(_, { "aria-hidden": !0 }),
            (0, V.jsx)(f, { children: o.error.message }),
          ],
        })),
      (t[28] = o.error),
      (t[29] = P));
  let I;
  t[30] !== N || t[31] !== P || t[32] !== k
    ? ((I = (0, V.jsxs)(g, { className: `flex-1 overflow-y-auto px-4`, children: [k, N, P] })),
      (t[30] = N),
      (t[31] = P),
      (t[32] = k),
      (t[33] = I))
    : (I = t[33]);
  let L;
  t[34] !== a || t[35] !== o.isPending
    ? ((L = (0, V.jsx)(F, { label: `Save branch`, pending: o.isPending, online: a })),
      (t[34] = a),
      (t[35] = o.isPending),
      (t[36] = L))
    : (L = t[36]);
  let R;
  return (
    t[37] !== x || t[38] !== I || t[39] !== L || t[40] !== E
      ? ((R = (0, V.jsxs)(`form`, {
          ref: x,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: E,
          children: [I, L],
        })),
        (t[37] = x),
        (t[38] = I),
        (t[39] = L),
        (t[40] = E),
        (t[41] = R))
      : (R = t[41]),
    R
  );
}
function H(e) {
  return { value: e.id, label: e.name };
}
function re(e) {
  let t = (0, B.c)(14),
    { branches: n, storeNames: r, onEdit: i, onDelete: a } = e,
    o;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((o = {
        id: `name`,
        header: `Branch`,
        meta: { className: `whitespace-normal font-medium` },
        cell: G,
      }),
      (t[0] = o))
    : (o = t[0]);
  let s;
  t[1] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((s = { className: `whitespace-normal` }), (t[1] = s))
    : (s = t[1]);
  let c;
  t[2] === r
    ? (c = t[3])
    : ((c = {
        id: `store`,
        header: `Store`,
        meta: s,
        cell: (e) => {
          let { row: t } = e;
          return r.get(t.original.storeId) ?? `Unknown store`;
        },
      }),
      (t[2] = r),
      (t[3] = c));
  let l;
  if (t[4] !== a || t[5] !== i || t[6] !== c) {
    if (((l = [o, c]), i || a)) {
      let e;
      (t[8] !== a || t[9] !== i
        ? ((e = {
            id: `actions`,
            header: W,
            cell: (e) => {
              let { row: t } = e;
              return (0, V.jsx)(P, {
                id: t.original.id,
                name: t.original.name,
                onEdit: i && (() => i(t.original)),
                onDelete: a && (() => a(t.original)),
              });
            },
          }),
          (t[8] = a),
          (t[9] = i),
          (t[10] = e))
        : (e = t[10]),
        l.push(e));
    }
    ((t[4] = a), (t[5] = i), (t[6] = c), (t[7] = l));
  } else l = t[7];
  let u;
  return (
    t[11] !== n || t[12] !== l
      ? ((u = (0, V.jsx)(d, {
          label: `Branches`,
          columns: l,
          data: n,
          getRowId: U,
          className: `min-h-0`,
        })),
        (t[11] = n),
        (t[12] = l),
        (t[13] = u))
      : (u = t[13]),
    u
  );
}
function U(e) {
  return e.id;
}
function W() {
  return (0, V.jsx)(`span`, { className: `sr-only`, children: `Actions` });
}
function G(e) {
  let { row: t } = e;
  return t.original.name;
}
function K() {
  let e = (0, B.c)(61),
    t;
  e[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((t = S()), (e[0] = t)) : (t = e[0]);
  let { data: n } = c(t),
    r;
  e[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((r = E()), (e[1] = r)) : (r = e[1]);
  let { data: i } = c(r),
    l;
  e[2] === n ? (l = e[3]) : ((l = n.includes(`store.read`)), (e[2] = n), (e[3] = l));
  let u = l,
    d;
  e[4] === Symbol.for(`react.memo_cache_sentinel`) ? ((d = k()), (e[4] = d)) : (d = e[4]);
  let f;
  e[5] === u ? (f = e[6]) : ((f = { ...d, enabled: u }), (e[5] = u), (e[6] = f));
  let p = s(f),
    m = p.data,
    h;
  e[7] === n ? (h = e[8]) : ((h = n.includes(`branch.write`)), (e[7] = n), (e[8] = h));
  let g = h,
    _ = g && u && !!m?.length,
    x = (0, ee.useRef)(null),
    C = R(x),
    w = R(x),
    D = !C.open && !w.open,
    j;
  e[9] !== _ || e[10] !== C || e[11] !== D
    ? ((j = { N: () => _ && D && C.show() }), (e[9] = _), (e[10] = C), (e[11] = D), (e[12] = j))
    : (j = e[12]);
  let P = A(j),
    F = i.length === 0;
  if (u && m?.length === 0) {
    let t;
    e[13] === Symbol.for(`react.memo_cache_sentinel`)
      ? ((t = (0, V.jsx)(M, { title: `Branches` })), (e[13] = t))
      : (t = e[13]);
    let n;
    return (
      e[14] === Symbol.for(`react.memo_cache_sentinel`)
        ? ((n = (0, V.jsxs)(`div`, {
            className: `flex flex-col gap-6`,
            children: [
              t,
              (0, V.jsx)(T, {
                icon: y,
                title: `Add a store first`,
                description: `Every branch belongs to a store. Add one, then come back to add its branches.`,
                children: (0, V.jsx)(a, {
                  asChild: !0,
                  children: (0, V.jsx)(o, { to: `/stores`, children: `Go to stores` }),
                }),
              }),
            ],
          })),
          (e[14] = n))
        : (n = e[14]),
      n
    );
  }
  let z;
  e[15] !== _ || e[16] !== C || e[17] !== F
    ? ((z =
        F || !_ ? void 0 : { label: `Add branch`, shortcut: `N`, onClick: () => C.show(), ref: x }),
      (e[15] = _),
      (e[16] = C),
      (e[17] = F),
      (e[18] = z))
    : (z = e[18]);
  let H;
  e[19] === z
    ? (H = e[20])
    : ((H = (0, V.jsx)(M, { title: `Branches`, action: z })), (e[19] = z), (e[20] = H));
  let U;
  e[21] !== u || e[22] !== g || e[23] !== p.isPending
    ? ((U =
        (!g || !u) &&
        !(u && p.isPending) &&
        (0, V.jsx)(b, {
          children: g
            ? `Viewing stores is needed to create or move a branch.`
            : `You can view branches. Ask an owner for permission to make changes.`,
        })),
      (e[21] = u),
      (e[22] = g),
      (e[23] = p.isPending),
      (e[24] = U))
    : (U = e[24]);
  let W;
  e[25] !== i ||
  e[26] !== _ ||
  e[27] !== g ||
  e[28] !== C ||
  e[29] !== F ||
  e[30] !== w ||
  e[31] !== m
    ? ((W = F
        ? (0, V.jsx)(T, {
            icon: v,
            title: `No branches yet`,
            description: `Tills and stock belong to a branch. Add the place where you sell.`,
            children:
              _ &&
              (0, V.jsxs)(a, {
                ref: x,
                onClick: () => C.show(),
                children: [`Add branch`, (0, V.jsx)(O, { "aria-hidden": !0, children: `N` })],
              }),
          })
        : (0, V.jsx)(re, {
            branches: i,
            storeNames: new Map((m ?? []).map(ie)),
            onEdit: _ ? (e) => C.show(e, N(e.id)) : void 0,
            onDelete: g ? (e) => w.show(e, I(e.id)) : void 0,
          })),
      (e[25] = i),
      (e[26] = _),
      (e[27] = g),
      (e[28] = C),
      (e[29] = F),
      (e[30] = w),
      (e[31] = m),
      (e[32] = W))
    : (W = e[32]);
  let G = C.value ? `Edit branch` : `New branch`,
    K = C.value
      ? `Rename the branch or move it to another store.`
      : `Name the branch and choose its store.`,
    q = C.value?.id ?? `new`,
    J;
  e[33] === m ? (J = e[34]) : ((J = m ?? []), (e[33] = m), (e[34] = J));
  let Y;
  e[35] === C ? (Y = e[36]) : ((Y = () => C.setOpen(!1)), (e[35] = C), (e[36] = Y));
  let X;
  e[37] !== C.value || e[38] !== q || e[39] !== J || e[40] !== Y
    ? ((X = (0, V.jsx)(ne, { branch: C.value, stores: J, onSaved: Y }, q)),
      (e[37] = C.value),
      (e[38] = q),
      (e[39] = J),
      (e[40] = Y),
      (e[41] = X))
    : (X = e[41]);
  let Z;
  e[42] !== C.open ||
  e[43] !== C.restoreFocus ||
  e[44] !== C.setOpen ||
  e[45] !== G ||
  e[46] !== K ||
  e[47] !== X
    ? ((Z = (0, V.jsx)(L, {
        open: C.open,
        onOpenChange: C.setOpen,
        title: G,
        description: K,
        restoreFocus: C.restoreFocus,
        children: X,
      })),
      (e[42] = C.open),
      (e[43] = C.restoreFocus),
      (e[44] = C.setOpen),
      (e[45] = G),
      (e[46] = K),
      (e[47] = X),
      (e[48] = Z))
    : (Z = e[48]);
  let Q;
  e[49] !== w.open || e[50] !== w.restoreFocus || e[51] !== w.setOpen || e[52] !== w.value
    ? ((Q = (0, V.jsx)(te, {
        branch: w.value,
        open: w.open,
        onOpenChange: w.setOpen,
        restoreFocus: w.restoreFocus,
      })),
      (e[49] = w.open),
      (e[50] = w.restoreFocus),
      (e[51] = w.setOpen),
      (e[52] = w.value),
      (e[53] = Q))
    : (Q = e[53]);
  let $;
  return (
    e[54] !== P || e[55] !== W || e[56] !== Z || e[57] !== Q || e[58] !== H || e[59] !== U
      ? (($ = (0, V.jsxs)(`div`, {
          ref: P,
          className: `flex min-h-0 flex-1 flex-col gap-6`,
          children: [H, U, W, Z, Q],
        })),
        (e[54] = P),
        (e[55] = W),
        (e[56] = Z),
        (e[57] = Q),
        (e[58] = H),
        (e[59] = U),
        (e[60] = $))
      : ($ = e[60]),
    $
  );
}
function ie(e) {
  return [e.id, e.name];
}
export { K as BranchesScreen };
