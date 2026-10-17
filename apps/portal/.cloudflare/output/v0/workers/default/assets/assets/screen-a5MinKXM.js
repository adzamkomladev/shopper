import {
  $ as e,
  A as t,
  Bt as n,
  Ht as r,
  P as i,
  R as a,
  W as o,
  Wt as s,
  _ as c,
  nt as l,
  u,
  y as d,
} from "./createLucideIcon-BBeoGZx-.js";
import { t as f } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as p, t as m } from "./text-BG7k3Olz.js";
import { t as h } from "./data-X9pOYu-7.js";
import { n as g, r as _, t as v } from "./alert-BTZapdK4.js";
import {
  a as y,
  c as b,
  d as x,
  n as S,
  o as C,
  r as w,
  s as T,
  t as E,
} from "./field-BUpdDBSZ.js";
import { t as D } from "./switch-DZfgHEV-.js";
import { C as O, L as k, S as A, T as j, w as M } from "./index-DZbZvBMN.js";
import { i as N, t as P } from "./online-B_7Uj1Wv.js";
import { a as F, n as I } from "./sheet-rEE2xq8n.js";
import { a as L, i as R, o as z, s as B, t as V } from "./panel-CiofwA_P.js";
import { t as H } from "./badge-Dxtl8kcr.js";
var U = s(r(), 1),
  W = c(),
  G = a({
    name: o(e(), l(), i(`Enter a role name`), t(100, `Keep the name to 100 characters or fewer`)),
    permissionCodes: d(e()),
  }),
  K = {
    "sale.create": `Ring up sales`,
    "refund.request": `Request refunds`,
    "refund.approve": `Approve refunds`,
    "shift.read": `View shifts`,
    "shift.write": `Open and close shifts`,
    "stock.read": `View stock`,
    "stock.write": `Change stock`,
    "product.read": `View products`,
    "product.write": `Change products`,
    "product.propose": `Propose product changes`,
    "tax.read": `View tax rules`,
    "tax.write": `Change tax rules`,
    "report.read": `View reports`,
    "audit.read": `View audit log`,
    "user.read": `View users`,
    "user.write": `Invite and manage users`,
    "role.read": `View roles`,
    "role.write": `Change roles`,
    "store.read": `View stores`,
    "store.write": `Change stores`,
    "branch.read": `View branches`,
    "branch.write": `Change branches`,
    "device.read": `View devices`,
    "device.enroll": `Enrol devices`,
    "device.revoke": `Revoke devices`,
    "cashier.pin.assign": `Set cashier PINs`,
  },
  q = [
    { name: `Sales`, codes: [`sale.create`, `refund.request`, `refund.approve`] },
    { name: `Shifts`, codes: [`shift.read`, `shift.write`] },
    {
      name: `Products and stock`,
      codes: [`product.read`, `product.write`, `product.propose`, `stock.read`, `stock.write`],
    },
    {
      name: `Tax, reports and audit`,
      codes: [`tax.read`, `tax.write`, `report.read`, `audit.read`],
    },
    { name: `People`, codes: [`user.read`, `user.write`, `role.read`, `role.write`] },
    {
      name: `Stores and branches`,
      codes: [`store.read`, `store.write`, `branch.read`, `branch.write`],
    },
    {
      name: `Devices`,
      codes: [`device.read`, `device.enroll`, `device.revoke`, `cashier.pin.assign`],
    },
  ],
  J = n();
function Y(e) {
  let t = (0, W.c)(12),
    { value: n, onChange: r, canGrant: i, tillCodes: a, readOnly: o } = e,
    s;
  t[0] !== r || t[1] !== n
    ? ((s = (e, t) => r(t ? [...n, e] : n.filter((t) => t !== e))),
      (t[0] = r),
      (t[1] = n),
      (t[2] = s))
    : (s = t[2]);
  let c = s,
    l;
  t[3] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((l = (0, J.jsx)(`p`, {
        className: `text-sm text-muted-foreground`,
        children: `Permissions marked Till also work on a till.`,
      })),
      (t[3] = l))
    : (l = t[3]);
  let u;
  t[4] !== i || t[5] !== o || t[6] !== a || t[7] !== c || t[8] !== n
    ? ((u = q.map((e) =>
        (0, J.jsxs)(
          b,
          {
            children: [
              (0, J.jsx)(T, { variant: `label`, children: e.name }),
              (0, J.jsx)(`div`, {
                className: `flex flex-col divide-y rounded-lg border`,
                children: e.codes.map((e) =>
                  (0, J.jsxs)(
                    E,
                    {
                      orientation: `horizontal`,
                      className: `px-4 py-3`,
                      children: [
                        (0, J.jsxs)(S, {
                          children: [
                            (0, J.jsxs)(C, {
                              htmlFor: `permission-${e}`,
                              children: [
                                K[e],
                                a.has(e) && (0, J.jsx)(H, { variant: `outline`, children: `Till` }),
                              ],
                            }),
                            (0, J.jsx)(w, { className: `font-mono text-xs`, children: e }),
                          ],
                        }),
                        (0, J.jsx)(D, {
                          id: `permission-${e}`,
                          checked: n.includes(e),
                          disabled: o || !i.has(e),
                          onCheckedChange: (t) => c(e, t),
                        }),
                      ],
                    },
                    e,
                  ),
                ),
              }),
            ],
          },
          e.name,
        ),
      )),
      (t[4] = i),
      (t[5] = o),
      (t[6] = a),
      (t[7] = c),
      (t[8] = n),
      (t[9] = u))
    : (u = t[9]);
  let d;
  return (
    t[10] === u
      ? (d = t[11])
      : ((d = (0, J.jsxs)(`div`, { className: `flex flex-col gap-6`, children: [l, u] })),
        (t[10] = u),
        (t[11] = d)),
    d
  );
}
function X(e, t, n) {
  if (e?.protectedOwner) return `The owner role always has every permission and can't be changed.`;
  if (!n) return `You don't have permission to change roles.`;
  if (e?.permissionCodes.some((e) => !t.has(e)))
    return `You can't change this role because it includes permissions you don't have.`;
}
function Z(e) {
  let t = (0, W.c)(57),
    { role: n, mine: r, tillCodes: i, canWrite: a, onSaved: o } = e,
    s = P(),
    c = j(n, o),
    l;
  t[0] !== a || t[1] !== r || t[2] !== n
    ? ((l = X(n, r, a)), (t[0] = a), (t[1] = r), (t[2] = n), (t[3] = l))
    : (l = t[3]);
  let d = l,
    f = q.every((e) => {
      let { codes: t } = e;
      return t.every((e) => r.has(e));
    })
      ? void 0
      : `You can't grant permissions you don't have yourself.`,
    h = n?.name ?? ``,
    b;
  t[4] === n?.permissionCodes
    ? (b = t[5])
    : ((b = n?.permissionCodes ?? []), (t[4] = n?.permissionCodes), (t[5] = b));
  let S;
  t[6] !== h || t[7] !== b
    ? ((S = { name: h, permissionCodes: b }), (t[6] = h), (t[7] = b), (t[8] = S))
    : (S = t[8]);
  let C = S,
    w;
  t[9] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((w = { onSubmit: G }), (t[9] = w))
    : (w = t[9]);
  let T;
  t[10] === c
    ? (T = t[11])
    : ((T = (e) => {
        let { value: t } = e;
        return c.mutate({ ...t, name: t.name.trim() });
      }),
      (t[10] = c),
      (t[11] = T));
  let E;
  t[12] !== C || t[13] !== T
    ? ((E = { defaultValues: C, validators: w, onSubmit: T, onSubmitInvalid: _ }),
      (t[12] = C),
      (t[13] = T),
      (t[14] = E))
    : (E = t[14]);
  let D = p(E),
    O;
  t[15] !== D || t[16] !== d || t[17] !== s || t[18] !== c.isPending
    ? ((O = {
        "Mod+Enter": () => {
          !d && s && !c.isPending && D.handleSubmit();
        },
      }),
      (t[15] = D),
      (t[16] = d),
      (t[17] = s),
      (t[18] = c.isPending),
      (t[19] = O))
    : (O = t[19]);
  let k = N(O),
    A;
  t[20] === c
    ? (A = t[21])
    : ((A = () => {
        c.isError && c.reset();
      }),
      (t[20] = c),
      (t[21] = A));
  let M = A,
    L;
  t[22] === D
    ? (L = t[23])
    : ((L = (e) => {
        (e.preventDefault(), D.handleSubmit());
      }),
      (t[22] = D),
      (t[23] = L));
  let R;
  t[24] !== f || t[25] !== d
    ? ((R =
        (d ?? f) &&
        (0, J.jsx)(`p`, { className: `text-sm text-muted-foreground`, children: d ?? f })),
      (t[24] = f),
      (t[25] = d),
      (t[26] = R))
    : (R = t[26]);
  let B;
  t[27] !== M || t[28] !== d
    ? ((B = (e) =>
        (0, J.jsx)(m, {
          field: e,
          label: `Name`,
          autoFocus: !d,
          autoComplete: `off`,
          disabled: !!d,
          onChange: M,
        })),
      (t[27] = M),
      (t[28] = d),
      (t[29] = B))
    : (B = t[29]);
  let V;
  t[30] !== D.Field || t[31] !== B
    ? ((V = (0, J.jsx)(D.Field, { name: `name`, children: B })),
      (t[30] = D.Field),
      (t[31] = B),
      (t[32] = V))
    : (V = t[32]);
  let H;
  t[33] !== M || t[34] !== d || t[35] !== r || t[36] !== i
    ? ((H = (e) =>
        (0, J.jsx)(Y, {
          value: e.state.value,
          onChange: (t) => {
            (e.handleChange(t), M());
          },
          canGrant: r,
          tillCodes: i,
          readOnly: !!d,
        })),
      (t[33] = M),
      (t[34] = d),
      (t[35] = r),
      (t[36] = i),
      (t[37] = H))
    : (H = t[37]);
  let U;
  t[38] !== D.Field || t[39] !== H
    ? ((U = (0, J.jsx)(D.Field, { name: `permissionCodes`, children: H })),
      (t[38] = D.Field),
      (t[39] = H),
      (t[40] = U))
    : (U = t[40]);
  let K;
  t[41] === c.error
    ? (K = t[42])
    : ((K =
        c.error &&
        (0, J.jsxs)(v, {
          variant: `destructive`,
          children: [
            (0, J.jsx)(x, { "aria-hidden": !0 }),
            (0, J.jsx)(g, { children: c.error.message }),
          ],
        })),
      (t[41] = c.error),
      (t[42] = K));
  let Z;
  t[43] !== R || t[44] !== V || t[45] !== U || t[46] !== K
    ? ((Z = (0, J.jsxs)(y, {
        role: `region`,
        "aria-label": `Role details and permissions`,
        tabIndex: 0,
        className: `flex-1 overflow-y-auto px-4`,
        children: [R, V, U, K],
      })),
      (t[43] = R),
      (t[44] = V),
      (t[45] = U),
      (t[46] = K),
      (t[47] = Z))
    : (Z = t[47]);
  let Q;
  t[48] !== d || t[49] !== s || t[50] !== c.isPending
    ? ((Q = d
        ? (0, J.jsx)(F, {
            children: (0, J.jsx)(I, {
              asChild: !0,
              children: (0, J.jsx)(u, { type: `button`, variant: `outline`, children: `Close` }),
            }),
          })
        : (0, J.jsx)(z, { label: `Save role`, pending: c.isPending, online: s })),
      (t[48] = d),
      (t[49] = s),
      (t[50] = c.isPending),
      (t[51] = Q))
    : (Q = t[51]);
  let $;
  return (
    t[52] !== k || t[53] !== L || t[54] !== Z || t[55] !== Q
      ? (($ = (0, J.jsxs)(`form`, {
          ref: k,
          noValidate: !0,
          className: `flex min-h-0 flex-1 flex-col`,
          onSubmit: L,
          children: [Z, Q],
        })),
        (t[52] = k),
        (t[53] = L),
        (t[54] = Z),
        (t[55] = Q),
        (t[56] = $))
      : ($ = t[56]),
    $
  );
}
function Q(e) {
  let t = (0, W.c)(14),
    { roles: n, total: r, canWrite: i, mine: a, onOpen: o } = e,
    s;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((s = {
        id: `name`,
        header: `Role`,
        meta: { className: `whitespace-normal font-medium` },
        cell: te,
      }),
      (t[0] = s))
    : (s = t[0]);
  let c;
  t[1] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = { className: `tabular-nums` }), (t[1] = c))
    : (c = t[1]);
  let l;
  t[2] === r
    ? (l = t[3])
    : ((l = {
        id: `permissions`,
        header: `Permissions`,
        meta: c,
        cell: (e) => {
          let { row: t } = e;
          return `${t.original.permissionCodes.length} of ${r}`;
        },
      }),
      (t[2] = r),
      (t[3] = l));
  let d;
  t[4] !== i || t[5] !== a || t[6] !== o
    ? ((d = {
        id: `actions`,
        header: ee,
        cell: (e) => {
          let { row: t } = e,
            n = !X(t.original, a, i);
          return (0, J.jsx)(`div`, {
            className: `flex justify-end`,
            children: (0, J.jsx)(u, {
              id: R(t.original.id),
              variant: `outline`,
              size: `sm`,
              "aria-label": `${n ? `Edit` : `View`} permissions for ${O(t.original)}`,
              onClick: () => o(t.original),
              children: n ? `Edit permissions` : `View permissions`,
            }),
          });
        },
      }),
      (t[4] = i),
      (t[5] = a),
      (t[6] = o),
      (t[7] = d))
    : (d = t[7]);
  let f;
  t[8] !== l || t[9] !== d ? ((f = [s, l, d]), (t[8] = l), (t[9] = d), (t[10] = f)) : (f = t[10]);
  let p = f,
    m;
  return (
    t[11] !== p || t[12] !== n
      ? ((m = (0, J.jsx)(h, {
          label: `Roles`,
          columns: p,
          data: n,
          getRowId: $,
          className: `min-h-0`,
        })),
        (t[11] = p),
        (t[12] = n),
        (t[13] = m))
      : (m = t[13]),
    m
  );
}
function $(e) {
  return e.id;
}
function ee() {
  return (0, J.jsx)(`span`, { className: `sr-only`, children: `Actions` });
}
function te(e) {
  let { row: t } = e;
  return O(t.original);
}
function ne() {
  let e = (0, W.c)(17),
    t;
  e[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((t = M()), (e[0] = t)) : (t = e[0]);
  let { data: n } = f(t),
    r;
  e[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((r = A()), (e[1] = r)) : (r = e[1]);
  let { data: i } = f(r),
    a;
  e[2] === Symbol.for(`react.memo_cache_sentinel`) ? ((a = k()), (e[2] = a)) : (a = e[2]);
  let { data: o } = f(a),
    s = (0, U.useRef)(null),
    c = V(s),
    l = new Set(o),
    u = l.has(`role.write`),
    d;
  e[3] === i ? (d = e[4]) : ((d = new Set(i.filter(ie).map(re))), (e[3] = i), (e[4] = d));
  let p = d,
    m;
  e[5] !== u || e[6] !== c
    ? ((m = { N: () => u && !c.open && c.show() }), (e[5] = u), (e[6] = c), (e[7] = m))
    : (m = e[7]);
  let h = N(m),
    g = c.value,
    _ = g ? (g.protectedOwner ? `Owner role` : X(g, l, u) ? `View role` : `Edit role`) : `New role`,
    v;
  e[8] !== u || e[9] !== c
    ? ((v = u ? { label: `New role`, shortcut: `N`, onClick: () => c.show(), ref: s } : void 0),
      (e[8] = u),
      (e[9] = c),
      (e[10] = v))
    : (v = e[10]);
  let y;
  e[11] === v
    ? (y = e[12])
    : ((y = (0, J.jsx)(L, { title: `Roles`, action: v })), (e[11] = v), (e[12] = y));
  let b;
  e[13] === c ? (b = e[14]) : ((b = (e) => c.show(e, R(e.id))), (e[13] = c), (e[14] = b));
  let x;
  return (
    e[15] === c ? (x = e[16]) : ((x = () => c.setOpen(!1)), (e[15] = c), (e[16] = x)),
    (0, J.jsxs)(`div`, {
      ref: h,
      className: `flex min-h-0 flex-1 flex-col gap-6`,
      children: [
        y,
        (0, J.jsx)(Q, { roles: n, total: i.length, canWrite: u, mine: l, onOpen: b }),
        (0, J.jsx)(B, {
          open: c.open,
          onOpenChange: c.setOpen,
          title: _,
          description: g
            ? `What members with this role can do.`
            : `Name the role and choose what it can do.`,
          restoreFocus: c.restoreFocus,
          className: `sm:max-w-xl`,
          children: (0, J.jsx)(
            Z,
            { role: g, mine: l, tillCodes: p, canWrite: u, onSaved: x },
            g?.id ?? `new`,
          ),
        }),
      ],
    })
  );
}
function re(e) {
  return e.code;
}
function ie(e) {
  return e.tillAllowed;
}
export { ne as RolesScreen };
