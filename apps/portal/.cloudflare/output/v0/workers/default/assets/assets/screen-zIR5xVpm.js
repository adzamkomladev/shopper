import {
  $ as e,
  Bt as t,
  C as n,
  Ht as r,
  M as i,
  R as a,
  W as o,
  Wt as s,
  _ as c,
  i as l,
  nt as u,
  u as d,
} from "./createLucideIcon-BBeoGZx-.js";
import { t as f } from "./session-C_gjqukj.js";
import { t as p } from "./link-BaidU34I.js";
import { t as m } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as h, t as g } from "./text-BG7k3Olz.js";
import { n as _, t as v } from "./alert-BTZapdK4.js";
import { a as y, d as b } from "./field-BUpdDBSZ.js";
import { t as x } from "./loader-circle-4Q5UpSxt.js";
import { Ft as S, Ut as C, Wt as w, s as T, u as E } from "./index-DZbZvBMN.js";
import { t as D } from "./success-DWWCnAdt.js";
var O = s(r(), 1),
  k = c();
function A(t) {
  return a({
    shopCode: t ? o(e(), u(), i(1, `Enter your shop code`)) : e(),
    email: o(e(), u(), n(`Enter a valid email address`)),
    password: o(e(), i(1, `Enter your password`)),
  });
}
var j = t();
function M(e) {
  let t = (0, k.c)(55),
    { box: n, defaultShopCode: r, onSignedIn: i } = e,
    a = T(n, i),
    o;
  t[0] === r
    ? (o = t[1])
    : ((o = { shopCode: r, email: ``, password: `` }), (t[0] = r), (t[1] = o));
  let s = !n,
    c;
  t[2] === s ? (c = t[3]) : ((c = A(s)), (t[2] = s), (t[3] = c));
  let u;
  t[4] === c ? (u = t[5]) : ((u = { onSubmit: c }), (t[4] = c), (t[5] = u));
  let f;
  t[6] === a
    ? (f = t[7])
    : ((f = (e) => {
        let { value: t } = e;
        return a.mutate({ ...t });
      }),
      (t[6] = a),
      (t[7] = f));
  let m;
  t[8] !== o || t[9] !== u || t[10] !== f
    ? ((m = { defaultValues: o, validators: u, onSubmit: f, onSubmitInvalid: P }),
      (t[8] = o),
      (t[9] = u),
      (t[10] = f),
      (t[11] = m))
    : (m = t[11]);
  let C = h(m),
    w = !n && !r ? `shopCode` : `email`,
    E = a.error,
    D = E instanceof l && E.field === `shopCode` ? E.message : void 0,
    O;
  t[12] === C
    ? (O = t[13])
    : ((O = (e) => {
        (e.preventDefault(), C.handleSubmit());
      }),
      (t[12] = C),
      (t[13] = O));
  let M;
  t[14] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((M = (0, j.jsx)(`h1`, { className: `sr-only`, children: `Log in to Shopper` })), (t[14] = M))
    : (M = t[14]);
  let F;
  t[15] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((F = (0, j.jsx)(`p`, {
        "aria-hidden": !0,
        className: `text-4xl font-semibold tracking-tight text-primary`,
        children: `Shopper`,
      })),
      (t[15] = F))
    : (F = t[15]);
  let I;
  t[16] === n
    ? (I = t[17])
    : ((I =
        n &&
        (0, j.jsx)(`p`, {
          className: `text-lg font-medium text-muted-foreground`,
          children: n.name,
        })),
      (t[16] = n),
      (t[17] = I));
  let L;
  t[18] === I
    ? (L = t[19])
    : ((L = (0, j.jsxs)(`div`, { className: `flex flex-col gap-2`, children: [F, I] })),
      (t[18] = I),
      (t[19] = L));
  let R;
  t[20] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((R = (0, j.jsx)(`p`, {
        className: `text-lg font-medium`,
        children: `For security reasons please enter your email and password to continue using point of sale`,
      })),
      (t[20] = R))
    : (R = t[20]);
  let z;
  t[21] !== n || t[22] !== w || t[23] !== C.Field || t[24] !== D
    ? ((z =
        !n &&
        (0, j.jsx)(C.Field, {
          name: `shopCode`,
          children: (e) =>
            (0, j.jsx)(g, {
              field: e,
              label: `Shop code`,
              className: `h-10`,
              serverError: D,
              autoFocus: w === `shopCode`,
              autoComplete: `organization`,
              autoCapitalize: `none`,
              spellCheck: !1,
            }),
        })),
      (t[21] = n),
      (t[22] = w),
      (t[23] = C.Field),
      (t[24] = D),
      (t[25] = z))
    : (z = t[25]);
  let B;
  t[26] === w
    ? (B = t[27])
    : ((B = (e) =>
        (0, j.jsx)(g, {
          field: e,
          label: `Email`,
          className: `h-10`,
          type: `email`,
          autoFocus: w === `email`,
          autoComplete: `username`,
        })),
      (t[26] = w),
      (t[27] = B));
  let V;
  t[28] !== C.Field || t[29] !== B
    ? ((V = (0, j.jsx)(C.Field, { name: `email`, children: B })),
      (t[28] = C.Field),
      (t[29] = B),
      (t[30] = V))
    : (V = t[30]);
  let H;
  t[31] === C.Field
    ? (H = t[32])
    : ((H = (0, j.jsx)(C.Field, { name: `password`, children: N })),
      (t[31] = C.Field),
      (t[32] = H));
  let U;
  t[33] !== z || t[34] !== V || t[35] !== H
    ? ((U = (0, j.jsxs)(y, { className: `gap-9`, children: [z, V, H] })),
      (t[33] = z),
      (t[34] = V),
      (t[35] = H),
      (t[36] = U))
    : (U = t[36]);
  let W;
  t[37] !== E || t[38] !== D
    ? ((W =
        E &&
        !D &&
        (0, j.jsxs)(v, {
          variant: `destructive`,
          children: [(0, j.jsx)(b, { "aria-hidden": !0 }), (0, j.jsx)(_, { children: E.message })],
        })),
      (t[37] = E),
      (t[38] = D),
      (t[39] = W))
    : (W = t[39]);
  let G;
  t[40] === a.isPending
    ? (G = t[41])
    : ((G = a.isPending && (0, j.jsx)(x, { className: `animate-spin` })),
      (t[40] = a.isPending),
      (t[41] = G));
  let K = a.isPending ? `Logging in…` : `Log in`,
    q;
  t[42] !== a.isPending || t[43] !== G || t[44] !== K
    ? ((q = (0, j.jsxs)(d, {
        type: `submit`,
        size: `lg`,
        className: `w-full rounded-full`,
        disabled: a.isPending,
        children: [G, K],
      })),
      (t[42] = a.isPending),
      (t[43] = G),
      (t[44] = K),
      (t[45] = q))
    : (q = t[45]);
  let J;
  t[46] === n
    ? (J = t[47])
    : ((J =
        !n &&
        (0, j.jsxs)(`p`, {
          className: `text-center text-sm text-muted-foreground`,
          children: [
            `New to Shopper?`,
            ` `,
            (0, j.jsx)(p, {
              to: `/signup`,
              className: `font-medium text-primary underline-offset-4 hover:underline`,
              children: `Create a shop`,
            }),
          ],
        })),
      (t[46] = n),
      (t[47] = J));
  let Y;
  return (
    t[48] !== L || t[49] !== U || t[50] !== W || t[51] !== q || t[52] !== J || t[53] !== O
      ? ((Y = (0, j.jsx)(S, {
          className: `px-6 sm:px-22`,
          children: (0, j.jsxs)(`form`, {
            noValidate: !0,
            className: `flex flex-col gap-9`,
            onSubmit: O,
            children: [M, L, R, U, W, q, J],
          }),
        })),
        (t[48] = L),
        (t[49] = U),
        (t[50] = W),
        (t[51] = q),
        (t[52] = J),
        (t[53] = O),
        (t[54] = Y))
      : (Y = t[54]),
    Y
  );
}
function N(e) {
  return (0, j.jsx)(g, {
    field: e,
    label: `Password`,
    className: `h-10`,
    type: `password`,
    autoComplete: `current-password`,
  });
}
function P(e) {
  let { formApi: t } = e,
    n = Object.entries(t.state.fieldMeta).find(F);
  n && document.getElementById(n[0])?.focus();
}
function F(e) {
  let [, t] = e;
  return t.errors.length;
}
function I() {
  let e = (0, k.c)(6),
    { data: t } = m(f),
    n;
  e[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((n = { from: `/login` }), (e[0] = n))
    : (n = e[0]);
  let { shop: r } = w(n),
    i = C(),
    [a, o] = (0, O.useState)(!1),
    s;
  return (
    e[1] !== t || e[2] !== i || e[3] !== r || e[4] !== a
      ? ((s = (0, j.jsx)(E, {
          children: a
            ? (0, j.jsx)(D, { onContinue: () => void i({ to: `/products` }) })
            : (0, j.jsx)(M, { box: t, defaultShopCode: r ?? ``, onSignedIn: () => o(!0) }),
        })),
        (e[1] = t),
        (e[2] = i),
        (e[3] = r),
        (e[4] = a),
        (e[5] = s))
      : (s = e[5]),
    s
  );
}
export { I as LoginScreen };
