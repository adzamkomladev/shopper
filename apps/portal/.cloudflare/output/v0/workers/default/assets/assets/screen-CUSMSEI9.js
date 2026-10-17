import {
  $ as e,
  Bt as t,
  C as n,
  Ht as r,
  P as i,
  R as a,
  U as o,
  W as s,
  Wt as c,
  _ as l,
  i as u,
  nt as d,
  t as f,
  u as p,
} from "./createLucideIcon-BBeoGZx-.js";
import { a as m } from "./session-C_gjqukj.js";
import { t as h } from "./useQuery-DCYgzPRk.js";
import { t as g } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as _, t as v } from "./text-BG7k3Olz.js";
import { t as y } from "./data-X9pOYu-7.js";
import { n as b, r as x, t as S } from "./alert-BTZapdK4.js";
import { t as C } from "./select-DV5qMU7p.js";
import { a as w, d as T, u as E } from "./field-BUpdDBSZ.js";
import {
  C as D,
  L as O,
  Ot as k,
  Q as A,
  _ as j,
  f as ee,
  g as te,
  h as ne,
  m as M,
  p as re,
  st as ie,
  w as ae,
} from "./index-DZbZvBMN.js";
import { t as oe } from "./control-BkhcDTnQ.js";
import { i as se, t as ce } from "./online-B_7Uj1Wv.js";
import { a as le, i as ue, o as de, s as fe, t as pe } from "./panel-CiofwA_P.js";
import { a as me, i as he, n as N, o as P, r as F, s as I, t as L } from "./dialog-CiSY6Yg1.js";
import { t as R } from "./dialog-D2WADKSD.js";
import { t as z } from "./now-CmhBBvQa.js";
import { t as ge } from "./groups-C7d-M_Dy.js";
import { t as B } from "./badge-Dxtl8kcr.js";
var V = {
  name: `copy`,
  size: 24,
  node: [
    [`rect`, { width: `14`, height: `14`, x: `8`, y: `8`, rx: `2`, ry: `2`, key: `17jyea` }],
    [`path`, { d: `M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2`, key: `zix9uf` }],
  ],
};
V.node;
var _e = f(V),
  H = {
    name: `mail`,
    size: 24,
    node: [
      [`path`, { d: `m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7`, key: `132q7q` }],
      [`rect`, { x: `2`, y: `4`, width: `20`, height: `16`, rx: `2`, key: `izxlao` }],
    ],
  };
H.node;
var ve = f(H),
  ye = c(r(), 1),
  U = l(),
  W = t();
function be(e) {
  let t = (0, U.c)(16),
    { invitation: n, open: r, onOpenChange: i, restoreFocus: a } = e,
    o;
  t[0] === i ? (o = t[1]) : ((o = () => i(!1)), (t[0] = i), (t[1] = o));
  let s = M(o),
    c = n?.email ?? `this invitation`,
    l;
  t[2] !== s || t[3] !== i
    ? ((l = (e) => {
        (e || s.reset(), i(e));
      }),
      (t[2] = s),
      (t[3] = i),
      (t[4] = l))
    : (l = t[4]);
  let u = `Cancel invitation for ${c}?`,
    d = s.error?.message,
    f;
  t[5] !== s || t[6] !== n
    ? ((f = () => n && s.mutate(n)), (t[5] = s), (t[6] = n), (t[7] = f))
    : (f = t[7]);
  let p;
  return (
    t[8] !== s.isPending ||
    t[9] !== r ||
    t[10] !== a ||
    t[11] !== l ||
    t[12] !== u ||
    t[13] !== d ||
    t[14] !== f
      ? ((p = (0, W.jsx)(R, {
          open: r,
          onOpenChange: l,
          title: u,
          description: `The link stops working straight away. You can invite them again later.`,
          confirmLabel: `Cancel invitation`,
          error: d,
          pending: s.isPending,
          onConfirm: f,
          restoreFocus: a,
        })),
        (t[8] = s.isPending),
        (t[9] = r),
        (t[10] = a),
        (t[11] = l),
        (t[12] = u),
        (t[13] = d),
        (t[14] = f),
        (t[15] = p))
      : (p = t[15]),
    p
  );
}
function xe(e) {
  let t = (0, U.c)(31),
    { member: n, roles: r, onSaved: i } = e,
    a = ce(),
    o = re(n, i),
    s;
  t[0] === n.roleId ? (s = t[1]) : ((s = { roleId: n.roleId }), (t[0] = n.roleId), (t[1] = s));
  let c;
  t[2] === o
    ? (c = t[3])
    : ((c = (e) => {
        let { value: t } = e;
        return o.mutate(t.roleId);
      }),
      (t[2] = o),
      (t[3] = c));
  let l;
  t[4] !== s || t[5] !== c
    ? ((l = { defaultValues: s, onSubmit: c }), (t[4] = s), (t[5] = c), (t[6] = l))
    : (l = t[6]);
  let u = _(l),
    d;
  t[7] !== o.isPending || t[8] !== u || t[9] !== a
    ? ((d = {
        "Mod+Enter": () => {
          a && !o.isPending && u.handleSubmit();
        },
      }),
      (t[7] = o.isPending),
      (t[8] = u),
      (t[9] = a),
      (t[10] = d))
    : (d = t[10]);
  let f = se(d),
    p;
  t[11] === u
    ? (p = t[12])
    : ((p = (e) => {
        (e.preventDefault(), u.handleSubmit());
      }),
      (t[11] = u),
      (t[12] = p));
  let m;
  t[13] === r
    ? (m = t[14])
    : ((m = (e) => (0, W.jsx)(C, { field: e, label: `Role`, autoFocus: !0, options: r.map(G) })),
      (t[13] = r),
      (t[14] = m));
  let h;
  t[15] !== u.Field || t[16] !== m
    ? ((h = (0, W.jsx)(u.Field, { name: `roleId`, children: m })),
      (t[15] = u.Field),
      (t[16] = m),
      (t[17] = h))
    : (h = t[17]);
  let g;
  t[18] === o.error
    ? (g = t[19])
    : ((g =
        o.error &&
        (0, W.jsxs)(S, {
          variant: `destructive`,
          children: [
            (0, W.jsx)(T, { "aria-hidden": !0 }),
            (0, W.jsx)(b, { children: o.error.message }),
          ],
        })),
      (t[18] = o.error),
      (t[19] = g));
  let v;
  t[20] !== h || t[21] !== g
    ? ((v = (0, W.jsxs)(w, { className: `flex-1 overflow-y-auto px-4`, children: [h, g] })),
      (t[20] = h),
      (t[21] = g),
      (t[22] = v))
    : (v = t[22]);
  let y;
  t[23] !== o.isPending || t[24] !== a
    ? ((y = (0, W.jsx)(de, { label: `Save role`, pending: o.isPending, online: a })),
      (t[23] = o.isPending),
      (t[24] = a),
      (t[25] = y))
    : (y = t[25]);
  let x;
  return (
    t[26] !== f || t[27] !== y || t[28] !== p || t[29] !== v
      ? ((x = (0, W.jsxs)(`form`, {
          ref: f,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: p,
          children: [v, y],
        })),
        (t[26] = f),
        (t[27] = y),
        (t[28] = p),
        (t[29] = v),
        (t[30] = x))
      : (x = t[30]),
    x
  );
}
function G(e) {
  return { value: e.id, label: D(e) };
}
function K(e, t) {
  switch (e.status) {
    case `accepted`:
      return { label: `Accepted`, variant: `default`, open: !1 };
    case `cancelled`:
      return { label: `Cancelled`, variant: `outline`, open: !1 };
    case `expired`:
      return { label: `Expired`, variant: `outline`, open: !1 };
    default:
      return Date.parse(e.expiresAt) <= t
        ? { label: `Expired`, variant: `outline`, open: !0 }
        : { label: `Pending`, variant: `secondary`, open: !0 };
  }
}
var q = { sent: `Email sent`, failed: `Email not delivered`, pending: `Sending email…` },
  J = (e) => (e.channel === `email` ? q[e.deliveryStatus ?? `pending`] : void 0),
  Y = 6e4,
  Se = (e) => `cancel-${e}`;
function Ce(e) {
  let t = (0, U.c)(17),
    { invitations: n, roleNames: r, actions: i } = e,
    a = z(Y),
    o;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((o = { id: `email`, header: `Invited`, meta: { className: `whitespace-normal` }, cell: Q }),
      (t[0] = o))
    : (o = t[0]);
  let s;
  t[1] === r
    ? (s = t[2])
    : ((s = {
        id: `role`,
        header: `Role`,
        cell: (e) => {
          let { row: t } = e;
          return (t.original.roleId && r.get(t.original.roleId)) || `—`;
        },
      }),
      (t[1] = r),
      (t[2] = s));
  let c;
  t[3] === a
    ? (c = t[4])
    : ((c = {
        id: `status`,
        header: `Status`,
        cell: (e) => {
          let { row: t } = e,
            n = K(t.original, a),
            r = n.label === `Pending` ? J(t.original) : void 0;
          return (0, W.jsxs)(`div`, {
            className: `flex flex-col items-start gap-1`,
            children: [
              (0, W.jsx)(B, { variant: n.variant, children: n.label }),
              r && (0, W.jsx)(`span`, { className: `text-xs text-muted-foreground`, children: r }),
            ],
          });
        },
      }),
      (t[3] = a),
      (t[4] = c));
  let l;
  t[5] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((l = { id: `expires`, header: `Expires`, cell: Z }), (t[5] = l))
    : (l = t[5]);
  let u;
  if (t[6] !== i || t[7] !== a || t[8] !== s || t[9] !== c) {
    if (((u = [o, s, c, l]), i)) {
      let e;
      (t[11] !== i || t[12] !== a
        ? ((e = {
            id: `actions`,
            header: X,
            cell: (e) => {
              let { row: t } = e,
                n = t.original;
              if (!K(n, a).open) return null;
              let r = n.channel === `email`;
              return (0, W.jsxs)(`div`, {
                className: `flex justify-end gap-2`,
                children: [
                  (0, W.jsx)(p, {
                    variant: `outline`,
                    size: `sm`,
                    disabled: i.pending,
                    "aria-label": r ? `Resend invitation to ${n.email}` : `New link for ${n.email}`,
                    onClick: () => i.onReissue(n),
                    children: r ? `Resend` : `New link`,
                  }),
                  (0, W.jsx)(p, {
                    id: Se(n.id),
                    variant: `outline`,
                    size: `sm`,
                    "aria-label": `Cancel invitation for ${n.email}`,
                    onClick: () => i.onCancel(n),
                    children: `Cancel`,
                  }),
                ],
              });
            },
          }),
          (t[11] = i),
          (t[12] = a),
          (t[13] = e))
        : (e = t[13]),
        u.push(e));
    }
    ((t[6] = i), (t[7] = a), (t[8] = s), (t[9] = c), (t[10] = u));
  } else u = t[10];
  let d;
  return (
    t[14] !== u || t[15] !== n
      ? ((d = (0, W.jsx)(y, {
          label: `Invitations`,
          columns: u,
          data: n,
          getRowId: we,
          className: `max-h-96`,
        })),
        (t[14] = u),
        (t[15] = n),
        (t[16] = d))
      : (d = t[16]),
    d
  );
}
function we(e) {
  return e.id;
}
function X() {
  return (0, W.jsx)(`span`, { className: `sr-only`, children: `Actions` });
}
function Z(e) {
  let { row: t } = e;
  return ge(t.original.expiresAt);
}
function Q(e) {
  let { row: t } = e;
  return (0, W.jsxs)(`div`, {
    className: `flex flex-col`,
    children: [
      (0, W.jsx)(`span`, { className: `font-medium`, children: t.original.email }),
      (0, W.jsx)(`span`, {
        className: `text-muted-foreground`,
        children: t.original.channel === `email` ? `By email` : `By setup link`,
      }),
    ],
  });
}
var $ = a({
    email: s(
      e(),
      d(),
      i(`Enter an email address`),
      n(`Enter an email address like ama@example.com`),
    ),
    roleId: s(e(), i(`Choose a role`)),
    channel: o([`email`, `local`]),
  }),
  Te = [
    { value: `email`, label: `Email the invitation` },
    { value: `local`, label: `Create a setup link` },
  ];
function Ee(e) {
  let t = (0, U.c)(39),
    { roles: n, reveal: r, onDone: i } = e,
    a = ce(),
    o = ne(r, i),
    s;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((s = { email: ``, roleId: ``, channel: `email` }), (t[0] = s))
    : (s = t[0]);
  let c;
  t[1] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = { onSubmit: $ }), (t[1] = c))
    : (c = t[1]);
  let l;
  t[2] === o
    ? (l = t[3])
    : ((l = {
        defaultValues: s,
        validators: c,
        onSubmit: (e) => {
          let { value: t } = e;
          return o.mutate(t);
        },
        onSubmitInvalid: x,
      }),
      (t[2] = o),
      (t[3] = l));
  let u = _(l),
    d;
  t[4] !== u || t[5] !== o.isPending || t[6] !== a
    ? ((d = {
        "Mod+Enter": () => {
          a && !o.isPending && u.handleSubmit();
        },
      }),
      (t[4] = u),
      (t[5] = o.isPending),
      (t[6] = a),
      (t[7] = d))
    : (d = t[7]);
  let f = se(d),
    p;
  t[8] === o
    ? (p = t[9])
    : ((p = () => {
        o.isError && o.reset();
      }),
      (t[8] = o),
      (t[9] = p));
  let m = p,
    h;
  t[10] === u
    ? (h = t[11])
    : ((h = (e) => {
        (e.preventDefault(), u.handleSubmit());
      }),
      (t[10] = u),
      (t[11] = h));
  let g;
  t[12] === m
    ? (g = t[13])
    : ((g = (e) =>
        (0, W.jsx)(v, {
          field: e,
          label: `Email`,
          type: `email`,
          autoFocus: !0,
          autoComplete: `off`,
          onChange: m,
        })),
      (t[12] = m),
      (t[13] = g));
  let y;
  t[14] !== u.Field || t[15] !== g
    ? ((y = (0, W.jsx)(u.Field, { name: `email`, children: g })),
      (t[14] = u.Field),
      (t[15] = g),
      (t[16] = y))
    : (y = t[16]);
  let E;
  t[17] === n
    ? (E = t[18])
    : ((E = (e) =>
        (0, W.jsx)(C, {
          field: e,
          label: `Role`,
          placeholder: `Choose a role`,
          options: n.map(Oe),
        })),
      (t[17] = n),
      (t[18] = E));
  let D;
  t[19] !== u.Field || t[20] !== E
    ? ((D = (0, W.jsx)(u.Field, { name: `roleId`, children: E })),
      (t[19] = u.Field),
      (t[20] = E),
      (t[21] = D))
    : (D = t[21]);
  let O;
  t[22] === u.Field
    ? (O = t[23])
    : ((O = (0, W.jsx)(u.Field, { name: `channel`, children: De })),
      (t[22] = u.Field),
      (t[23] = O));
  let k;
  t[24] === o.error
    ? (k = t[25])
    : ((k =
        o.error &&
        (0, W.jsxs)(S, {
          variant: `destructive`,
          children: [
            (0, W.jsx)(T, { "aria-hidden": !0 }),
            (0, W.jsx)(b, { children: o.error.message }),
          ],
        })),
      (t[24] = o.error),
      (t[25] = k));
  let A;
  t[26] !== D || t[27] !== O || t[28] !== k || t[29] !== y
    ? ((A = (0, W.jsxs)(w, { className: `flex-1 overflow-y-auto px-4`, children: [y, D, O, k] })),
      (t[26] = D),
      (t[27] = O),
      (t[28] = k),
      (t[29] = y),
      (t[30] = A))
    : (A = t[30]);
  let j;
  t[31] !== o.isPending || t[32] !== a
    ? ((j = (0, W.jsx)(de, { label: `Send invitation`, pending: o.isPending, online: a })),
      (t[31] = o.isPending),
      (t[32] = a),
      (t[33] = j))
    : (j = t[33]);
  let ee;
  return (
    t[34] !== f || t[35] !== A || t[36] !== j || t[37] !== h
      ? ((ee = (0, W.jsxs)(`form`, {
          ref: f,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: h,
          children: [A, j],
        })),
        (t[34] = f),
        (t[35] = A),
        (t[36] = j),
        (t[37] = h),
        (t[38] = ee))
      : (ee = t[38]),
    ee
  );
}
function De(e) {
  return (0, W.jsx)(C, { field: e, label: `How to send it`, options: Te });
}
function Oe(e) {
  return { value: e.id, label: D(e) };
}
function ke(e) {
  let t = (0, U.c)(9),
    { members: n, onChangeRole: r } = e,
    i,
    a;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((i = { id: `name`, header: `Name`, meta: { className: `whitespace-normal` }, cell: Ne }),
      (a = { id: `role`, header: `Role`, cell: Me }),
      (t[0] = i),
      (t[1] = a))
    : ((i = t[0]), (a = t[1]));
  let o;
  if (t[2] !== r) {
    if (((o = [i, a]), r)) {
      let e = (e) => {
          let { row: t } = e;
          return (0, W.jsx)(`div`, {
            className: `flex justify-end`,
            children: (0, W.jsx)(p, {
              id: ue(t.original.id),
              variant: `outline`,
              size: `sm`,
              "aria-label": `Change role for ${t.original.name}`,
              onClick: () => r(t.original),
              children: `Change role`,
            }),
          });
        },
        n;
      (t[4] === e
        ? (n = t[5])
        : ((n = { id: `actions`, header: je, cell: e }), (t[4] = e), (t[5] = n)),
        o.push(n));
    }
    ((t[2] = r), (t[3] = o));
  } else o = t[3];
  let s;
  return (
    t[6] !== o || t[7] !== n
      ? ((s = (0, W.jsx)(y, {
          label: `Members`,
          columns: o,
          data: n,
          getRowId: Ae,
          className: `max-h-96`,
        })),
        (t[6] = o),
        (t[7] = n),
        (t[8] = s))
      : (s = t[8]),
    s
  );
}
function Ae(e) {
  return e.id;
}
function je() {
  return (0, W.jsx)(`span`, { className: `sr-only`, children: `Actions` });
}
function Me(e) {
  let { row: t } = e;
  return D({ name: t.original.roleName, protectedOwner: t.original.protectedOwner });
}
function Ne(e) {
  let { row: t } = e;
  return (0, W.jsxs)(`div`, {
    className: `flex flex-col`,
    children: [
      (0, W.jsx)(`span`, { className: `font-medium`, children: t.original.name }),
      (0, W.jsxs)(`span`, {
        className: `flex items-center gap-2 text-muted-foreground`,
        children: [
          t.original.email,
          !t.original.emailVerified &&
            (0, W.jsx)(B, { variant: `outline`, children: `Not verified` }),
        ],
      }),
    ],
  });
}
function Pe(e) {
  let t = (0, U.c)(30),
    { revealed: n, open: r, onOpenChange: i, restoreFocus: a } = e,
    o = (0, ye.useRef)(null),
    s = (0, ye.useRef)(null),
    c;
  t[0] === n
    ? (c = t[1])
    : ((c = async function () {
        if (n)
          try {
            (await navigator.clipboard.writeText(n.link), k.success(`Link copied`));
          } catch {
            (s.current?.select(), k.message(`Press Ctrl+C to copy the selected link`));
          }
      }),
      (t[0] = n),
      (t[1] = c));
  let l = c,
    u;
  t[2] === l ? (u = t[3]) : ((u = { C: () => void l() }), (t[2] = l), (t[3] = u));
  let d = se(u),
    f;
  t[4] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((f = (e) => {
        (e.preventDefault(), o.current?.focus());
      }),
      (t[4] = f))
    : (f = t[4]);
  let m;
  t[5] === a
    ? (m = t[6])
    : ((m = (e) => {
        (e.preventDefault(), a());
      }),
      (t[5] = a),
      (t[6] = m));
  let h;
  t[7] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((h = (0, W.jsx)(I, { children: `Setup link ready` })), (t[7] = h))
    : (h = t[7]);
  let g = n?.email ?? `them`,
    _;
  t[8] === g
    ? (_ = t[9])
    : ((_ = (0, W.jsxs)(P, {
        children: [
          h,
          (0, W.jsxs)(he, {
            children: [
              `Send this link to `,
              g,
              `. It works once and stops working after 7 days, or as soon as you make a new link.`,
            ],
          }),
        ],
      })),
      (t[8] = g),
      (t[9] = _));
  let v;
  t[10] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((v = (0, W.jsx)(E, { htmlFor: `setup-link`, children: `Setup link` })), (t[10] = v))
    : (v = t[10]);
  let y = n?.link ?? ``,
    b;
  t[11] === y
    ? (b = t[12])
    : ((b = (0, W.jsxs)(`div`, {
        className: `flex flex-col gap-2`,
        children: [v, (0, W.jsx)(oe, { id: `setup-link`, ref: s, readOnly: !0, value: y })],
      })),
      (t[11] = y),
      (t[12] = b));
  let x;
  t[13] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((x = (0, W.jsx)(N, {
        asChild: !0,
        children: (0, W.jsx)(p, { variant: `outline`, children: `Done` }),
      })),
      (t[13] = x))
    : (x = t[13]);
  let S;
  t[14] === l ? (S = t[15]) : ((S = () => void l()), (t[14] = l), (t[15] = S));
  let C;
  t[16] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((C = (0, W.jsx)(_e, { "aria-hidden": !0 })), (t[16] = C))
    : (C = t[16]);
  let w;
  t[17] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((w = (0, W.jsx)(ie, { "aria-hidden": !0, children: `C` })), (t[17] = w))
    : (w = t[17]);
  let T;
  t[18] === S
    ? (T = t[19])
    : ((T = (0, W.jsxs)(me, {
        children: [x, (0, W.jsxs)(p, { ref: o, onClick: S, children: [C, `Copy link`, w] })],
      })),
      (t[18] = S),
      (t[19] = T));
  let D;
  t[20] !== d || t[21] !== b || t[22] !== T || t[23] !== m || t[24] !== _
    ? ((D = (0, W.jsxs)(F, {
        ref: d,
        onOpenAutoFocus: f,
        onCloseAutoFocus: m,
        children: [_, b, T],
      })),
      (t[20] = d),
      (t[21] = b),
      (t[22] = T),
      (t[23] = m),
      (t[24] = _),
      (t[25] = D))
    : (D = t[25]);
  let O;
  return (
    t[26] !== i || t[27] !== r || t[28] !== D
      ? ((O = (0, W.jsx)(L, { open: r, onOpenChange: i, children: D })),
        (t[26] = i),
        (t[27] = r),
        (t[28] = D),
        (t[29] = O))
      : (O = t[29]),
    O
  );
}
var Fe = [];
function Ie() {
  let e = (0, U.c)(112),
    t;
  e[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((t = j()), (e[0] = t)) : (t = e[0]);
  let { data: n } = g(t),
    r;
  e[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((r = ee()), (e[1] = r)) : (r = e[1]);
  let { data: i } = g(r),
    a;
  e[2] === Symbol.for(`react.memo_cache_sentinel`) ? ((a = O()), (e[2] = a)) : (a = e[2]);
  let { data: o } = g(a),
    s;
  e[3] === Symbol.for(`react.memo_cache_sentinel`) ? ((s = m()), (e[3] = s)) : (s = e[3]);
  let { data: c } = g(s),
    l;
  e[4] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((l = { ...ae(), retry: !1 }), (e[4] = l))
    : (l = e[4]);
  let d = h(l),
    f = d.data ?? Fe,
    p = d.error instanceof u && d.error.status === 403,
    _;
  if (e[5] !== o || e[6] !== n || e[7] !== f || e[8] !== c?.user) {
    let t;
    e[10] === c?.user
      ? (t = e[11])
      : ((t = (e) => e.id === c?.user.id), (e[10] = c?.user), (e[11] = t));
    let r = n.find(t);
    ((_ = f.filter(
      (e) =>
        (r?.protectedOwner || !e.protectedOwner) && e.permissionCodes.every((e) => o.includes(e)),
    )),
      (e[5] = o),
      (e[6] = n),
      (e[7] = f),
      (e[8] = c?.user),
      (e[9] = _));
  } else _ = e[9];
  let v = _,
    y = (0, ye.useRef)(null),
    b = pe(y),
    x = pe(y),
    S = pe(y),
    C = pe(y),
    w;
  e[12] === S ? (w = e[13]) : ((w = (e) => S.show(e)), (e[12] = S), (e[13] = w));
  let T = te(w),
    E;
  e[14] === o ? (E = e[15]) : ((E = o.includes(`role.write`)), (e[14] = o), (e[15] = E));
  let D = E,
    k = D && d.data !== void 0 && v.length > 0,
    ne;
  e[16] !== k || e[17] !== o
    ? ((ne = k && o.includes(`user.write`)), (e[16] = k), (e[17] = o), (e[18] = ne))
    : (ne = e[18]);
  let M = ne,
    re = !b.open && !x.open && !S.open && !C.open,
    ie;
  e[19] !== M || e[20] !== b || e[21] !== re
    ? ((ie = { I: () => M && re && b.show() }),
      (e[19] = M),
      (e[20] = b),
      (e[21] = re),
      (e[22] = ie))
    : (ie = e[22]);
  let oe = se(ie),
    ce;
  e[23] === i ? (ce = e[24]) : ((ce = i.filter(Re)), (e[23] = i), (e[24] = ce));
  let de = ce,
    me;
  e[25] === f ? (me = e[26]) : ((me = new Map(f.map(Le))), (e[25] = f), (e[26] = me));
  let he = me,
    N;
  e[27] !== M || e[28] !== b
    ? ((N = M ? { label: `Invite user`, shortcut: `I`, onClick: () => b.show(), ref: y } : void 0),
      (e[27] = M),
      (e[28] = b),
      (e[29] = N))
    : (N = e[29]);
  let P;
  e[30] === N
    ? (P = e[31])
    : ((P = (0, W.jsx)(le, { title: `Users`, action: N })), (e[30] = N), (e[31] = P));
  let F;
  e[32] === D
    ? (F = e[33])
    : ((F =
        !D &&
        (0, W.jsx)(`p`, {
          className: `-mt-3 text-sm text-muted-foreground`,
          children: `You can see who has access. Changing roles or inviting people needs the role permission.`,
        })),
      (e[32] = D),
      (e[33] = F));
  let I;
  e[34] !== D || e[35] !== d.isPending
    ? ((I =
        D &&
        d.isPending &&
        (0, W.jsx)(`p`, {
          className: `-mt-3 text-sm text-muted-foreground`,
          role: `status`,
          children: `Loading role choices…`,
        })),
      (e[34] = D),
      (e[35] = d.isPending),
      (e[36] = I))
    : (I = e[36]);
  let L;
  e[37] !== D || e[38] !== d.data || e[39] !== d.isError || e[40] !== p
    ? ((L =
        D &&
        d.isError &&
        !d.data &&
        (0, W.jsx)(`p`, {
          className: `-mt-3 text-sm text-muted-foreground`,
          role: `status`,
          children: p
            ? `Role choices aren’t available because you can’t read the role list. Check your access and refresh.`
            : `Role choices couldn’t load. Check your connection and refresh to try again.`,
        })),
      (e[37] = D),
      (e[38] = d.data),
      (e[39] = d.isError),
      (e[40] = p),
      (e[41] = L))
    : (L = e[41]);
  let R;
  e[42] !== D || e[43] !== v || e[44] !== d.data
    ? ((R =
        D &&
        d.data &&
        v.length === 0 &&
        (0, W.jsx)(`p`, {
          className: `-mt-3 text-sm text-muted-foreground`,
          role: `status`,
          children: `No roles are available within your permission level to assign.`,
        })),
      (e[42] = D),
      (e[43] = v),
      (e[44] = d.data),
      (e[45] = R))
    : (R = e[45]);
  let z;
  e[46] !== k || e[47] !== o
    ? ((z =
        k &&
        !o.includes(`user.write`) &&
        (0, W.jsx)(`p`, {
          className: `-mt-3 text-sm text-muted-foreground`,
          children: `You can change roles. Inviting people needs the user permission.`,
        })),
      (e[46] = k),
      (e[47] = o),
      (e[48] = z))
    : (z = e[48]);
  let ge;
  e[49] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((ge = (0, W.jsx)(`h2`, { className: `text-lg font-semibold`, children: `Members` })),
      (e[49] = ge))
    : (ge = e[49]);
  let B;
  e[50] !== k || e[51] !== x
    ? ((B = k ? (e) => x.show(e, ue(e.id)) : void 0), (e[50] = k), (e[51] = x), (e[52] = B))
    : (B = e[52]);
  let V;
  e[53] !== n || e[54] !== B
    ? ((V = (0, W.jsxs)(`section`, {
        className: `flex flex-col gap-3`,
        children: [ge, (0, W.jsx)(ke, { members: n, onChangeRole: B })],
      })),
      (e[53] = n),
      (e[54] = B),
      (e[55] = V))
    : (V = e[55]);
  let _e;
  e[56] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((_e = (0, W.jsx)(`h2`, { className: `text-lg font-semibold`, children: `Invitations` })),
      (e[56] = _e))
    : (_e = e[56]);
  let H;
  e[57] !== M || e[58] !== C || e[59] !== de || e[60] !== T || e[61] !== he
    ? ((H = (0, W.jsxs)(`section`, {
        className: `flex flex-col gap-3`,
        children: [
          _e,
          de.length === 0
            ? (0, W.jsx)(A, {
                icon: ve,
                title: `No invitations yet`,
                description: `Invitations you send show up here with their status, so you can send them again or cancel them.`,
              })
            : (0, W.jsx)(Ce, {
                invitations: de,
                roleNames: he,
                actions: M
                  ? {
                      pending: T.isPending,
                      onReissue: (e) => T.mutate(e),
                      onCancel: (e) => C.show(e, Se(e.id)),
                    }
                  : void 0,
              }),
        ],
      })),
      (e[57] = M),
      (e[58] = C),
      (e[59] = de),
      (e[60] = T),
      (e[61] = he),
      (e[62] = H))
    : (H = e[62]);
  let G;
  e[63] !== b || e[64] !== S.open
    ? ((G = () => !S.open && b.restoreFocus()), (e[63] = b), (e[64] = S.open), (e[65] = G))
    : (G = e[65]);
  let K;
  e[66] === S ? (K = e[67]) : ((K = (e) => S.show(e)), (e[66] = S), (e[67] = K));
  let q;
  e[68] === b ? (q = e[69]) : ((q = () => b.setOpen(!1)), (e[68] = b), (e[69] = q));
  let J;
  e[70] !== v || e[71] !== K || e[72] !== q
    ? ((J = (0, W.jsx)(Ee, { roles: v, reveal: K, onDone: q })),
      (e[70] = v),
      (e[71] = K),
      (e[72] = q),
      (e[73] = J))
    : (J = e[73]);
  let Y;
  e[74] !== b.open || e[75] !== b.setOpen || e[76] !== G || e[77] !== J
    ? ((Y = (0, W.jsx)(fe, {
        open: b.open,
        onOpenChange: b.setOpen,
        title: `Invite a user`,
        description: `They get a link to choose a password and sign in with the role you pick.`,
        restoreFocus: G,
        children: J,
      })),
      (e[74] = b.open),
      (e[75] = b.setOpen),
      (e[76] = G),
      (e[77] = J),
      (e[78] = Y))
    : (Y = e[78]);
  let we = `Choose the role ${x.value?.name ?? `this member`} signs in with.`,
    X;
  e[79] !== v || e[80] !== x
    ? ((X =
        x.value &&
        (0, W.jsx)(xe, { member: x.value, roles: v, onSaved: () => x.setOpen(!1) }, x.value.id)),
      (e[79] = v),
      (e[80] = x),
      (e[81] = X))
    : (X = e[81]);
  let Z;
  e[82] !== x.open || e[83] !== x.restoreFocus || e[84] !== x.setOpen || e[85] !== we || e[86] !== X
    ? ((Z = (0, W.jsx)(fe, {
        open: x.open,
        onOpenChange: x.setOpen,
        title: `Change role`,
        description: we,
        restoreFocus: x.restoreFocus,
        children: X,
      })),
      (e[82] = x.open),
      (e[83] = x.restoreFocus),
      (e[84] = x.setOpen),
      (e[85] = we),
      (e[86] = X),
      (e[87] = Z))
    : (Z = e[87]);
  let Q;
  e[88] !== S.open || e[89] !== S.restoreFocus || e[90] !== S.setOpen || e[91] !== S.value
    ? ((Q = (0, W.jsx)(Pe, {
        revealed: S.value,
        open: S.open,
        onOpenChange: S.setOpen,
        restoreFocus: S.restoreFocus,
      })),
      (e[88] = S.open),
      (e[89] = S.restoreFocus),
      (e[90] = S.setOpen),
      (e[91] = S.value),
      (e[92] = Q))
    : (Q = e[92]);
  let $;
  e[93] !== C.open || e[94] !== C.restoreFocus || e[95] !== C.setOpen || e[96] !== C.value
    ? (($ = (0, W.jsx)(be, {
        invitation: C.value,
        open: C.open,
        onOpenChange: C.setOpen,
        restoreFocus: C.restoreFocus,
      })),
      (e[93] = C.open),
      (e[94] = C.restoreFocus),
      (e[95] = C.setOpen),
      (e[96] = C.value),
      (e[97] = $))
    : ($ = e[97]);
  let Te;
  return (
    e[98] !== oe ||
    e[99] !== P ||
    e[100] !== F ||
    e[101] !== I ||
    e[102] !== L ||
    e[103] !== R ||
    e[104] !== z ||
    e[105] !== V ||
    e[106] !== H ||
    e[107] !== Y ||
    e[108] !== Z ||
    e[109] !== Q ||
    e[110] !== $
      ? ((Te = (0, W.jsxs)(`div`, {
          ref: oe,
          className: `flex min-h-0 flex-1 flex-col gap-6`,
          children: [P, F, I, L, R, z, V, H, Y, Z, Q, $],
        })),
        (e[98] = oe),
        (e[99] = P),
        (e[100] = F),
        (e[101] = I),
        (e[102] = L),
        (e[103] = R),
        (e[104] = z),
        (e[105] = V),
        (e[106] = H),
        (e[107] = Y),
        (e[108] = Z),
        (e[109] = Q),
        (e[110] = $),
        (e[111] = Te))
      : (Te = e[111]),
    Te
  );
}
function Le(e) {
  return [e.id, e.name];
}
function Re(e) {
  return e.status !== `replaced`;
}
export { Ie as UsersScreen };
