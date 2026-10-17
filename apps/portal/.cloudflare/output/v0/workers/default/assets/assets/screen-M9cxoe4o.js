import {
  $ as e,
  Bt as t,
  Ht as n,
  J as r,
  P as i,
  R as a,
  W as o,
  Wt as s,
  _ as c,
  i as l,
  t as u,
  u as d,
  zt as f,
} from "./createLucideIcon-BBeoGZx-.js";
import { t as p } from "./link-BaidU34I.js";
import { t as m } from "./useQuery-DCYgzPRk.js";
import { t as h } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as g, t as _ } from "./text-BG7k3Olz.js";
import { t as v } from "./data-X9pOYu-7.js";
import { a as y, n as b, r as x, t as S } from "./alert-BTZapdK4.js";
import { t as C } from "./select-DV5qMU7p.js";
import { a as w, d as T } from "./field-BUpdDBSZ.js";
import { t as E } from "./monitor-smartphone-DtjXIvTH.js";
import {
  D,
  E as O,
  L as k,
  O as A,
  Q as j,
  _ as ee,
  dt as te,
  k as ne,
  st as re,
} from "./index-DZbZvBMN.js";
import { i as ie, t as M } from "./online-B_7Uj1Wv.js";
import { a as ae, n as N } from "./sheet-rEE2xq8n.js";
import { a as oe, o as P, r as se, s as ce, t as le } from "./panel-CiofwA_P.js";
import { t as F } from "./dialog-D2WADKSD.js";
import { n as I, t as ue } from "./groups-C7d-M_Dy.js";
import { t as L } from "./badge-Dxtl8kcr.js";
var R = {
  name: `circle`,
  size: 24,
  node: [[`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }]],
};
R.node;
var de = u(R),
  z = {
    name: `key-round`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z`,
          key: `1s6t7t`,
        },
      ],
      [`circle`, { cx: `16.5`, cy: `7.5`, r: `.5`, fill: `currentColor`, key: `w0ekpg` }],
    ],
  };
z.node;
var fe = u(z),
  pe = s(n(), 1),
  me = c(),
  B = a({ branchId: o(e(), i(`Choose a branch`)) }),
  V = t();
function he(e) {
  let t = (0, me.c)(49),
    { branches: n } = e,
    r = M(),
    i = D(),
    a,
    o;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = { branchId: `` }), (o = { onSubmit: B }), (t[0] = a), (t[1] = o))
    : ((a = t[0]), (o = t[1]));
  let s;
  t[2] === i
    ? (s = t[3])
    : ((s = {
        defaultValues: a,
        validators: o,
        onSubmit: (e) => {
          let { value: t } = e;
          return i.mutate(t.branchId);
        },
        onSubmitInvalid: x,
      }),
      (t[2] = i),
      (t[3] = s));
  let c = g(s),
    l;
  t[4] !== c || t[5] !== i.data || t[6] !== i.isPending || t[7] !== r
    ? ((l = {
        "Mod+Enter": () => {
          !i.data && r && !i.isPending && c.handleSubmit();
        },
      }),
      (t[4] = c),
      (t[5] = i.data),
      (t[6] = i.isPending),
      (t[7] = r),
      (t[8] = l))
    : (l = t[8]);
  let u = ie(l);
  if (i.data) {
    let e;
    t[9] === i.data.code
      ? (e = t[10])
      : ((e = i.data.code.slice(0, 3)), (t[9] = i.data.code), (t[10] = e));
    let n;
    t[11] === i.data.code
      ? (n = t[12])
      : ((n = i.data.code.slice(3)), (t[11] = i.data.code), (t[12] = n));
    let r;
    t[13] !== e || t[14] !== n
      ? ((r = [e, n]), (t[13] = e), (t[14] = n), (t[15] = r))
      : (r = t[15]);
    let [a, o] = r,
      s;
    t[16] === i.data.expiresAt
      ? (s = t[17])
      : ((s = I(i.data.expiresAt)), (t[16] = i.data.expiresAt), (t[17] = s));
    let c;
    t[18] === s
      ? (c = t[19])
      : ((c = (0, V.jsxs)(`p`, {
          className: `text-sm text-muted-foreground`,
          children: [`Enter this code on the till. It works once, and expires`, ` `, s, `.`],
        })),
        (t[18] = s),
        (t[19] = c));
    let l;
    t[20] !== a || t[21] !== o
      ? ((l = (0, V.jsxs)(`output`, {
          "aria-label": `Enrolment code`,
          className: `rounded-lg border bg-muted/50 py-6 text-center text-4xl font-semibold tracking-widest tabular-nums`,
          children: [a, ` `, o],
        })),
        (t[20] = a),
        (t[21] = o),
        (t[22] = l))
      : (l = t[22]);
    let u;
    t[23] !== l || t[24] !== c
      ? ((u = (0, V.jsxs)(`div`, {
          className: `flex flex-1 flex-col gap-4 px-4`,
          children: [c, l],
        })),
        (t[23] = l),
        (t[24] = c),
        (t[25] = u))
      : (u = t[25]);
    let f;
    t[26] === Symbol.for(`react.memo_cache_sentinel`)
      ? ((f = (0, V.jsx)(ae, {
          children: (0, V.jsx)(N, {
            asChild: !0,
            children: (0, V.jsxs)(d, {
              ref: y,
              children: [`Done`, (0, V.jsx)(re, { "aria-hidden": !0, children: `↵` })],
            }),
          }),
        })),
        (t[26] = f))
      : (f = t[26]);
    let p;
    return (
      t[27] === u
        ? (p = t[28])
        : ((p = (0, V.jsxs)(`div`, {
            className: `flex min-h-0 flex-1 flex-col`,
            children: [u, f],
          })),
          (t[27] = u),
          (t[28] = p)),
      p
    );
  }
  let f;
  t[29] === c
    ? (f = t[30])
    : ((f = (e) => {
        (e.preventDefault(), c.handleSubmit());
      }),
      (t[29] = c),
      (t[30] = f));
  let p;
  t[31] === n
    ? (p = t[32])
    : ((p = (e) =>
        (0, V.jsx)(C, {
          field: e,
          label: `Branch`,
          placeholder: `Choose a branch`,
          autoFocus: !0,
          options: n.map(H),
        })),
      (t[31] = n),
      (t[32] = p));
  let m;
  t[33] !== c.Field || t[34] !== p
    ? ((m = (0, V.jsx)(c.Field, { name: `branchId`, children: p })),
      (t[33] = c.Field),
      (t[34] = p),
      (t[35] = m))
    : (m = t[35]);
  let h;
  t[36] === i.error
    ? (h = t[37])
    : ((h =
        i.error &&
        (0, V.jsxs)(S, {
          variant: `destructive`,
          children: [
            (0, V.jsx)(T, { "aria-hidden": !0 }),
            (0, V.jsx)(b, { children: i.error.message }),
          ],
        })),
      (t[36] = i.error),
      (t[37] = h));
  let _;
  t[38] !== m || t[39] !== h
    ? ((_ = (0, V.jsxs)(w, { className: `flex-1 overflow-y-auto px-4`, children: [m, h] })),
      (t[38] = m),
      (t[39] = h),
      (t[40] = _))
    : (_ = t[40]);
  let v;
  t[41] !== i.isPending || t[42] !== r
    ? ((v = (0, V.jsx)(P, {
        label: `Create code`,
        pendingLabel: `Creating…`,
        pending: i.isPending,
        online: r,
      })),
      (t[41] = i.isPending),
      (t[42] = r),
      (t[43] = v))
    : (v = t[43]);
  let E;
  return (
    t[44] !== u || t[45] !== v || t[46] !== f || t[47] !== _
      ? ((E = (0, V.jsxs)(`form`, {
          ref: u,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: f,
          children: [_, v],
        })),
        (t[44] = u),
        (t[45] = v),
        (t[46] = f),
        (t[47] = _),
        (t[48] = E))
      : (E = t[48]),
    E
  );
}
function H(e) {
  return { value: e.id, label: e.name };
}
var U = a({
  userId: o(e(), i(`Choose a cashier`)),
  pin: o(e(), r(/^\d{4,8}$/, `Use 4 to 8 digits, like 4829`)),
});
function ge(e) {
  let t = (0, me.c)(40),
    { members: n, unavailableMessage: r, onSaved: i } = e,
    a = M(),
    o = ne(i),
    s,
    c;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((s = { userId: ``, pin: `` }), (c = { onSubmit: U }), (t[0] = s), (t[1] = c))
    : ((s = t[0]), (c = t[1]));
  let l;
  t[2] !== n || t[3] !== o
    ? ((l = {
        defaultValues: s,
        validators: c,
        onSubmit: (e) => {
          let { value: t } = e;
          return o.mutate({ ...t, name: n.find((e) => e.id === t.userId)?.name ?? `` });
        },
        onSubmitInvalid: x,
      }),
      (t[2] = n),
      (t[3] = o),
      (t[4] = l))
    : (l = t[4]);
  let u = g(l),
    d;
  t[5] !== u || t[6] !== a || t[7] !== o.isPending
    ? ((d = {
        "Mod+Enter": () => {
          a && !o.isPending && u.handleSubmit();
        },
      }),
      (t[5] = u),
      (t[6] = a),
      (t[7] = o.isPending),
      (t[8] = d))
    : (d = t[8]);
  let f = ie(d),
    p;
  t[9] === o
    ? (p = t[10])
    : ((p = () => {
        o.isError && o.reset();
      }),
      (t[9] = o),
      (t[10] = p));
  let m = p,
    h;
  t[11] === u
    ? (h = t[12])
    : ((h = (e) => {
        (e.preventDefault(), u.handleSubmit());
      }),
      (t[11] = u),
      (t[12] = h));
  let v;
  t[13] === n
    ? (v = t[14])
    : ((v = (e) =>
        (0, V.jsx)(C, {
          field: e,
          label: `Cashier`,
          placeholder: `Choose a cashier`,
          autoFocus: !0,
          options: n.map(W),
        })),
      (t[13] = n),
      (t[14] = v));
  let y;
  t[15] !== u.Field || t[16] !== v
    ? ((y = (0, V.jsx)(u.Field, { name: `userId`, children: v })),
      (t[15] = u.Field),
      (t[16] = v),
      (t[17] = y))
    : (y = t[17]);
  let E;
  t[18] === m
    ? (E = t[19])
    : ((E = (e) =>
        (0, V.jsx)(_, {
          field: e,
          label: `PIN`,
          description: `They type it on the till to sign in. It replaces any PIN they have.`,
          type: `password`,
          inputMode: `numeric`,
          autoComplete: `off`,
          onChange: m,
        })),
      (t[18] = m),
      (t[19] = E));
  let D;
  t[20] !== u.Field || t[21] !== E
    ? ((D = (0, V.jsx)(u.Field, { name: `pin`, children: E })),
      (t[20] = u.Field),
      (t[21] = E),
      (t[22] = D))
    : (D = t[22]);
  let O;
  t[23] === r
    ? (O = t[24])
    : ((O =
        r &&
        (0, V.jsx)(`p`, {
          className: `text-sm text-muted-foreground`,
          role: `status`,
          children: r,
        })),
      (t[23] = r),
      (t[24] = O));
  let k;
  t[25] === o.error
    ? (k = t[26])
    : ((k =
        o.error &&
        (0, V.jsxs)(S, {
          variant: `destructive`,
          children: [
            (0, V.jsx)(T, { "aria-hidden": !0 }),
            (0, V.jsx)(b, { children: o.error.message }),
          ],
        })),
      (t[25] = o.error),
      (t[26] = k));
  let A;
  t[27] !== D || t[28] !== O || t[29] !== k || t[30] !== y
    ? ((A = (0, V.jsxs)(w, { className: `flex-1 overflow-y-auto px-4`, children: [y, D, O, k] })),
      (t[27] = D),
      (t[28] = O),
      (t[29] = k),
      (t[30] = y),
      (t[31] = A))
    : (A = t[31]);
  let j;
  t[32] !== a || t[33] !== o.isPending
    ? ((j = (0, V.jsx)(P, { label: `Save PIN`, pending: o.isPending, online: a })),
      (t[32] = a),
      (t[33] = o.isPending),
      (t[34] = j))
    : (j = t[34]);
  let ee;
  return (
    t[35] !== f || t[36] !== A || t[37] !== j || t[38] !== h
      ? ((ee = (0, V.jsxs)(`form`, {
          ref: f,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: h,
          children: [A, j],
        })),
        (t[35] = f),
        (t[36] = A),
        (t[37] = j),
        (t[38] = h),
        (t[39] = ee))
      : (ee = t[39]),
    ee
  );
}
function W(e) {
  return { value: e.id, label: e.name };
}
function _e(e) {
  let t = (0, me.c)(16),
    { device: n, open: r, onOpenChange: i, restoreFocus: a } = e,
    o;
  t[0] === i ? (o = t[1]) : ((o = () => i(!1)), (t[0] = i), (t[1] = o));
  let s = A(o),
    c = n?.name ?? `this device`,
    l;
  t[2] !== i || t[3] !== s
    ? ((l = (e) => {
        (e || s.reset(), i(e));
      }),
      (t[2] = i),
      (t[3] = s),
      (t[4] = l))
    : (l = t[4]);
  let u = `Revoke ${c}?`,
    d = s.error?.message,
    f;
  t[5] !== n || t[6] !== s
    ? ((f = () => n && s.mutate(n)), (t[5] = n), (t[6] = s), (t[7] = f))
    : (f = t[7]);
  let p;
  return (
    t[8] !== r ||
    t[9] !== a ||
    t[10] !== s.isPending ||
    t[11] !== l ||
    t[12] !== u ||
    t[13] !== d ||
    t[14] !== f
      ? ((p = (0, V.jsx)(F, {
          open: r,
          onOpenChange: l,
          title: u,
          description: `This device can no longer sign in cashiers. Enrol it again to bring it back.`,
          confirmLabel: `Revoke device`,
          error: d,
          pending: s.isPending,
          onConfirm: f,
          restoreFocus: a,
        })),
        (t[8] = r),
        (t[9] = a),
        (t[10] = s.isPending),
        (t[11] = l),
        (t[12] = u),
        (t[13] = d),
        (t[14] = f),
        (t[15] = p))
      : (p = t[15]),
    p
  );
}
function ve(e) {
  let t = (0, me.c)(11),
    { devices: n, onRevoke: r } = e,
    i,
    a,
    o,
    s;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((i = {
        id: `name`,
        header: `Device`,
        meta: { className: `whitespace-normal font-medium` },
        cell: ye,
      }),
      (a = { id: `branch`, header: `Branch`, cell: Y }),
      (o = { id: `status`, header: `Status`, cell: J }),
      (s = { id: `added`, header: `Added`, cell: q }),
      (t[0] = i),
      (t[1] = a),
      (t[2] = o),
      (t[3] = s))
    : ((i = t[0]), (a = t[1]), (o = t[2]), (s = t[3]));
  let c;
  if (t[4] !== r) {
    if (((c = [i, a, o, s]), r)) {
      let e = (e) => {
          let { row: t } = e;
          return (
            t.original.status === `active` &&
            (0, V.jsx)(`div`, {
              className: `flex justify-end`,
              children: (0, V.jsx)(d, {
                id: se(t.original.id),
                variant: `outline`,
                size: `sm`,
                "aria-label": `Revoke ${t.original.name}`,
                onClick: () => r(t.original),
                children: `Revoke`,
              }),
            })
          );
        },
        n;
      (t[6] === e
        ? (n = t[7])
        : ((n = { id: `actions`, header: K, cell: e }), (t[6] = e), (t[7] = n)),
        c.push(n));
    }
    ((t[4] = r), (t[5] = c));
  } else c = t[5];
  let l;
  return (
    t[8] !== c || t[9] !== n
      ? ((l = (0, V.jsx)(v, {
          label: `Devices`,
          columns: c,
          data: n,
          getRowId: G,
          className: `min-h-0`,
        })),
        (t[8] = c),
        (t[9] = n),
        (t[10] = l))
      : (l = t[10]),
    l
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
  return ue(t.original.createdAt);
}
function J(e) {
  let { row: t } = e;
  return t.original.status === `active`
    ? (0, V.jsxs)(L, {
        variant: `outline`,
        children: [
          (0, V.jsx)(de, { "aria-hidden": !0, className: `fill-success text-success` }),
          `Active`,
        ],
      })
    : (0, V.jsx)(L, { variant: `secondary`, children: `Revoked` });
}
function Y(e) {
  let { row: t } = e;
  return t.original.branchName;
}
function ye(e) {
  let { row: t } = e;
  return t.original.name;
}
function X() {
  let e = (0, me.c)(92),
    t = f(),
    n;
  e[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((n = O()), (e[0] = n)) : (n = e[0]);
  let { data: r } = h(n),
    i;
  e[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((i = k()), (e[1] = i)) : (i = e[1]);
  let { data: a } = h(i),
    o;
  e[2] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((o = { ...te(), retry: !1 }), (e[2] = o))
    : (o = e[2]);
  let s = m(o),
    c;
  e[3] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = { ...ee(), retry: !1 }), (e[3] = c))
    : (c = e[3]);
  let u = m(c),
    g = (0, pe.useRef)(null),
    _ = (0, pe.useRef)(null),
    v = le(g),
    y = le(_),
    b = le(g),
    x;
  e[4] !== s.data?.length || e[5] !== a
    ? ((x = a.includes(`device.enroll`) && !!s.data?.length),
      (e[4] = s.data?.length),
      (e[5] = a),
      (e[6] = x))
    : (x = e[6]);
  let S = x,
    C;
  e[7] === a ? (C = e[8]) : ((C = a.includes(`cashier.pin.assign`)), (e[7] = a), (e[8] = C));
  let w = C,
    T;
  e[9] === a ? (T = e[10]) : ((T = a.includes(`branch.read`)), (e[9] = a), (e[10] = T));
  let D = T,
    A;
  e[11] !== D || e[12] !== a
    ? ((A = a.includes(`device.enroll`) && !D), (e[11] = D), (e[12] = a), (e[13] = A))
    : (A = e[13]);
  let ne = A,
    M;
  e[14] !== s.isError || e[15] !== D || e[16] !== a
    ? ((M = a.includes(`device.enroll`) && D && s.isError),
      (e[14] = s.isError),
      (e[15] = D),
      (e[16] = a),
      (e[17] = M))
    : (M = e[17]);
  let ae = M,
    N = !v.open && !y.open && !b.open,
    P;
  e[18] !== S || e[19] !== v || e[20] !== N
    ? ((P = () => S && N && v.show()), (e[18] = S), (e[19] = v), (e[20] = N), (e[21] = P))
    : (P = e[21]);
  let F;
  e[22] !== w || e[23] !== N || e[24] !== y
    ? ((F = () => w && N && y.show()), (e[22] = w), (e[23] = N), (e[24] = y), (e[25] = F))
    : (F = e[25]);
  let I;
  e[26] !== F || e[27] !== P
    ? ((I = { N: P, P: F }), (e[26] = F), (e[27] = P), (e[28] = I))
    : (I = e[28]);
  let ue = ie(I),
    L = r.length === 0,
    R;
  e[29] !== v || e[30] !== t
    ? ((R = (e) => {
        (v.setOpen(e), e || t.invalidateQueries({ queryKey: [`devices`] }));
      }),
      (e[29] = v),
      (e[30] = t),
      (e[31] = R))
    : (R = e[31]);
  let de = R,
    z;
  e[32] !== S || e[33] !== v || e[34] !== L
    ? ((z =
        S && !L
          ? { label: `Enrol device`, shortcut: `N`, onClick: () => v.show(), ref: g }
          : void 0),
      (e[32] = S),
      (e[33] = v),
      (e[34] = L),
      (e[35] = z))
    : (z = e[35]);
  let B;
  e[36] !== w || e[37] !== y
    ? ((B =
        w &&
        (0, V.jsxs)(d, {
          ref: _,
          variant: `outline`,
          onClick: () => y.show(),
          children: [
            (0, V.jsx)(fe, { "aria-hidden": !0 }),
            `Set cashier PIN`,
            (0, V.jsx)(re, { "aria-hidden": !0, children: `P` }),
          ],
        })),
      (e[36] = w),
      (e[37] = y),
      (e[38] = B))
    : (B = e[38]);
  let H;
  e[39] !== z || e[40] !== B
    ? ((H = (0, V.jsx)(oe, { title: `Devices`, action: z, children: B })),
      (e[39] = z),
      (e[40] = B),
      (e[41] = H))
    : (H = e[41]);
  let U;
  e[42] !== ne || e[43] !== L
    ? ((U =
        ne &&
        !L &&
        (0, V.jsx)(`p`, {
          className: `-mt-3 text-sm text-muted-foreground`,
          children: `To enrol a device you need to be able to see branches. Ask an owner to enrol it.`,
        })),
      (e[42] = ne),
      (e[43] = L),
      (e[44] = U))
    : (U = e[44]);
  let W;
  e[45] !== ae || e[46] !== L
    ? ((W =
        ae &&
        !L &&
        (0, V.jsx)(`p`, {
          className: `-mt-3 text-sm text-muted-foreground`,
          role: `status`,
          children: `Branch choices couldn’t load. Check your connection and refresh to try again.`,
        })),
      (e[45] = ae),
      (e[46] = L),
      (e[47] = W))
    : (W = e[47]);
  let G;
  e[48] !== s.data?.length ||
  e[49] !== S ||
  e[50] !== r ||
  e[51] !== v ||
  e[52] !== a ||
  e[53] !== L ||
  e[54] !== b
    ? ((G = L
        ? (0, V.jsxs)(j, {
            icon: E,
            title: `No devices yet`,
            description:
              s.data?.length === 0
                ? `A device is a till that signs cashiers in to a branch. Add a branch first, then enrol the till.`
                : `A device is a till that signs cashiers in to a branch. Enrol the till to get started.`,
            children: [
              s.data?.length === 0 &&
                (0, V.jsx)(d, {
                  asChild: !0,
                  children: (0, V.jsx)(p, { to: `/branches`, children: `Go to branches` }),
                }),
              S &&
                (0, V.jsxs)(d, {
                  ref: g,
                  onClick: () => v.show(),
                  children: [`Enrol device`, (0, V.jsx)(re, { "aria-hidden": !0, children: `N` })],
                }),
            ],
          })
        : (0, V.jsx)(ve, {
            devices: r,
            onRevoke: a.includes(`device.revoke`) ? (e) => b.show(e, se(e.id)) : void 0,
          })),
      (e[48] = s.data?.length),
      (e[49] = S),
      (e[50] = r),
      (e[51] = v),
      (e[52] = a),
      (e[53] = L),
      (e[54] = b),
      (e[55] = G))
    : (G = e[55]);
  let K;
  e[56] === s.data ? (K = e[57]) : ((K = s.data ?? []), (e[56] = s.data), (e[57] = K));
  let q;
  e[58] === K ? (q = e[59]) : ((q = (0, V.jsx)(he, { branches: K })), (e[58] = K), (e[59] = q));
  let J;
  e[60] !== de || e[61] !== v.open || e[62] !== v.restoreFocus || e[63] !== q
    ? ((J = (0, V.jsx)(ce, {
        open: v.open,
        onOpenChange: de,
        title: `Enrol a device`,
        description: `Choose the branch the till will work in. You get a code to enter on the till.`,
        restoreFocus: v.restoreFocus,
        children: q,
      })),
      (e[60] = de),
      (e[61] = v.open),
      (e[62] = v.restoreFocus),
      (e[63] = q),
      (e[64] = J))
    : (J = e[64]);
  let Y;
  e[65] === u.data ? (Y = e[66]) : ((Y = u.data ?? []), (e[65] = u.data), (e[66] = Y));
  let ye = u.isError
      ? u.error instanceof l && u.error.status === 403
        ? `You can't see the member list, so ask an owner to set the PIN.`
        : `Couldn't load the member list. Check your connection and refresh to try again.`
      : void 0,
    X;
  e[67] === y ? (X = e[68]) : ((X = () => y.setOpen(!1)), (e[67] = y), (e[68] = X));
  let Z;
  e[69] !== Y || e[70] !== ye || e[71] !== X
    ? ((Z = (0, V.jsx)(ge, { members: Y, unavailableMessage: ye, onSaved: X })),
      (e[69] = Y),
      (e[70] = ye),
      (e[71] = X),
      (e[72] = Z))
    : (Z = e[72]);
  let Q;
  e[73] !== y.open || e[74] !== y.restoreFocus || e[75] !== y.setOpen || e[76] !== Z
    ? ((Q = (0, V.jsx)(ce, {
        open: y.open,
        onOpenChange: y.setOpen,
        title: `Set cashier PIN`,
        description: `Give a member a PIN to sign in on a till.`,
        restoreFocus: y.restoreFocus,
        children: Z,
      })),
      (e[73] = y.open),
      (e[74] = y.restoreFocus),
      (e[75] = y.setOpen),
      (e[76] = Z),
      (e[77] = Q))
    : (Q = e[77]);
  let $;
  e[78] !== b.open || e[79] !== b.restoreFocus || e[80] !== b.setOpen || e[81] !== b.value
    ? (($ = (0, V.jsx)(_e, {
        device: b.value,
        open: b.open,
        onOpenChange: b.setOpen,
        restoreFocus: b.restoreFocus,
      })),
      (e[78] = b.open),
      (e[79] = b.restoreFocus),
      (e[80] = b.setOpen),
      (e[81] = b.value),
      (e[82] = $))
    : ($ = e[82]);
  let be;
  return (
    e[83] !== ue ||
    e[84] !== H ||
    e[85] !== U ||
    e[86] !== W ||
    e[87] !== G ||
    e[88] !== J ||
    e[89] !== Q ||
    e[90] !== $
      ? ((be = (0, V.jsxs)(`div`, {
          ref: ue,
          className: `flex min-h-0 flex-1 flex-col gap-6`,
          children: [H, U, W, G, J, Q, $],
        })),
        (e[83] = ue),
        (e[84] = H),
        (e[85] = U),
        (e[86] = W),
        (e[87] = G),
        (e[88] = J),
        (e[89] = Q),
        (e[90] = $),
        (e[91] = be))
      : (be = e[91]),
    be
  );
}
export { X as DevicesScreen };
