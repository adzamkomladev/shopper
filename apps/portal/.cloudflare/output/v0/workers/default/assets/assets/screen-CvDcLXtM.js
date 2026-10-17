import { Bt as e, Ht as t, Wt as n, _ as r, i, u as a } from "./createLucideIcon-BBeoGZx-.js";
import { t as o } from "./link-BaidU34I.js";
import { t as s } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as c, t as l } from "./text-BG7k3Olz.js";
import { a as u, n as d, r as f, t as p } from "./alert-BTZapdK4.js";
import { a as m, d as h } from "./field-BUpdDBSZ.js";
import { t as g } from "./loader-circle-4Q5UpSxt.js";
import {
  Ut as _,
  Wt as v,
  c as y,
  d as b,
  n as x,
  r as S,
  s as C,
  t as w,
  u as T,
} from "./index-DZbZvBMN.js";
import { t as E } from "./success-DWWCnAdt.js";
import { n as D, t as O } from "./onboarding-c8b95Dmh.js";
var k = n(t(), 1),
  A = r(),
  j = e();
function M(e) {
  if (e instanceof i) return e.status === 409 ? `shopCode` : e.field;
}
function N(e) {
  let t = (0, A.c)(52),
    { link: n, email: r, shopCode: i, onSignedIn: s } = e,
    u = C(null, s),
    _;
  t[0] === u ? (_ = t[1]) : ((_ = (e) => u.mutate(e)), (t[0] = u), (t[1] = _));
  let v = x(n, _),
    y;
  t[2] === i ? (y = t[3]) : ((y = { shopCode: i, password: `` }), (t[2] = i), (t[3] = y));
  let S;
  t[4] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((S = { onSubmit: D }), (t[4] = S))
    : (S = t[4]);
  let w;
  t[5] === v
    ? (w = t[6])
    : ((w = (e) => {
        let { value: t } = e;
        return v.mutate({ ...t }, { onError: P });
      }),
      (t[5] = v),
      (t[6] = w));
  let T;
  t[7] !== y || t[8] !== w
    ? ((T = { defaultValues: y, validators: S, onSubmit: w, onSubmitInvalid: f }),
      (t[7] = y),
      (t[8] = w),
      (t[9] = T))
    : (T = t[9]);
  let E = c(T),
    k = v.error,
    N;
  t[10] === k ? (N = t[11]) : ((N = M(k)), (t[10] = k), (t[11] = N));
  let F = N,
    I = v.isSuccess,
    L = `${r} is verified. Choose your shop code and a password to finish.`,
    R;
  t[12] === E
    ? (R = t[13])
    : ((R = (e) => {
        (e.preventDefault(), E.handleSubmit());
      }),
      (t[12] = E),
      (t[13] = R));
  let z;
  t[14] !== k?.message || t[15] !== F
    ? ((z = (e) =>
        (0, j.jsx)(l, {
          field: e,
          label: `Password`,
          type: `password`,
          autoFocus: !0,
          autoComplete: `new-password`,
          description: `At least 12 characters.`,
          serverError: F === `password` ? k?.message : void 0,
        })),
      (t[14] = k?.message),
      (t[15] = F),
      (t[16] = z))
    : (z = t[16]);
  let B;
  t[17] !== E.Field || t[18] !== z
    ? ((B = (0, j.jsx)(E.Field, { name: `password`, children: z })),
      (t[17] = E.Field),
      (t[18] = z),
      (t[19] = B))
    : (B = t[19]);
  let V;
  t[20] !== k?.message || t[21] !== F
    ? ((V = (e) =>
        (0, j.jsx)(l, {
          field: e,
          label: `Shop code`,
          description: O,
          autoCapitalize: `none`,
          spellCheck: !1,
          serverError: F === `shopCode` ? k?.message : void 0,
        })),
      (t[20] = k?.message),
      (t[21] = F),
      (t[22] = V))
    : (V = t[22]);
  let H;
  t[23] !== E.Field || t[24] !== V
    ? ((H = (0, j.jsx)(E.Field, { name: `shopCode`, children: V })),
      (t[23] = E.Field),
      (t[24] = V),
      (t[25] = H))
    : (H = t[25]);
  let U;
  t[26] !== B || t[27] !== H
    ? ((U = (0, j.jsxs)(m, { className: `gap-6`, children: [B, H] })),
      (t[26] = B),
      (t[27] = H),
      (t[28] = U))
    : (U = t[28]);
  let W;
  t[29] !== k || t[30] !== F
    ? ((W =
        k &&
        !F &&
        (0, j.jsxs)(p, {
          variant: `destructive`,
          children: [(0, j.jsx)(h, { "aria-hidden": !0 }), (0, j.jsx)(d, { children: k.message })],
        })),
      (t[29] = k),
      (t[30] = F),
      (t[31] = W))
    : (W = t[31]);
  let G;
  t[32] !== v.data || t[33] !== I || t[34] !== u.error
    ? ((G =
        I &&
        u.error &&
        (0, j.jsxs)(p, {
          variant: `destructive`,
          children: [
            (0, j.jsx)(h, { "aria-hidden": !0 }),
            (0, j.jsxs)(d, {
              children: [
                `Your shop is ready, but we couldn't log you in: `,
                u.error.message,
                ` `,
                (0, j.jsx)(o, {
                  to: `/login`,
                  search: { shop: v.data.shopCode },
                  className: `underline`,
                  children: `Log in`,
                }),
              ],
            }),
          ],
        })),
      (t[32] = v.data),
      (t[33] = I),
      (t[34] = u.error),
      (t[35] = G))
    : (G = t[35]);
  let K = v.isPending || u.isPending,
    q;
  t[36] !== v.isPending || t[37] !== u.isPending
    ? ((q = (v.isPending || u.isPending) && (0, j.jsx)(g, { className: `animate-spin` })),
      (t[36] = v.isPending),
      (t[37] = u.isPending),
      (t[38] = q))
    : (q = t[38]);
  let J = v.isPending ? `Creating your shop…` : u.isPending ? `Logging in…` : `Create shop`,
    Y;
  t[39] !== K || t[40] !== q || t[41] !== J
    ? ((Y = (0, j.jsxs)(a, {
        type: `submit`,
        size: `lg`,
        className: `w-full rounded-full`,
        disabled: K,
        children: [q, J],
      })),
      (t[39] = K),
      (t[40] = q),
      (t[41] = J),
      (t[42] = Y))
    : (Y = t[42]);
  let X;
  t[43] !== U || t[44] !== W || t[45] !== G || t[46] !== Y || t[47] !== R
    ? ((X = (0, j.jsxs)(`form`, {
        noValidate: !0,
        className: `flex flex-col gap-9`,
        onSubmit: R,
        children: [U, W, G, Y],
      })),
      (t[43] = U),
      (t[44] = W),
      (t[45] = G),
      (t[46] = Y),
      (t[47] = R),
      (t[48] = X))
    : (X = t[48]);
  let Z;
  return (
    t[49] !== X || t[50] !== L
      ? ((Z = (0, j.jsx)(b, { title: `Set up your shop`, description: L, children: X })),
        (t[49] = X),
        (t[50] = L),
        (t[51] = Z))
      : (Z = t[51]),
    Z
  );
}
function P(e) {
  let t = M(e);
  t && document.getElementById(t)?.focus();
}
function F(e) {
  let t = (0, A.c)(2),
    { shopCode: n } = e,
    r;
  return (
    t[0] === n
      ? (r = t[1])
      : ((r = (0, j.jsx)(b, {
          title: `Your shop is already set up`,
          description: `This link has done its job. Log in with your email and password to carry on.`,
          children: (0, j.jsx)(a, {
            asChild: !0,
            size: `lg`,
            className: `w-full rounded-full`,
            children: (0, j.jsx)(o, { to: `/login`, search: { shop: n }, children: `Log in` }),
          }),
        })),
        (t[0] = n),
        (t[1] = r)),
    r
  );
}
function I(e) {
  let t = (0, A.c)(24),
    { link: n, email: r, shopName: i } = e,
    o = S(n),
    s;
  t[0] === i
    ? (s = t[1])
    : ((s = (0, j.jsx)(`strong`, { className: `text-foreground`, children: i })),
      (t[0] = i),
      (t[1] = s));
  let c;
  t[2] === r
    ? (c = t[3])
    : ((c = (0, j.jsx)(`strong`, { className: `text-foreground`, children: r })),
      (t[2] = r),
      (t[3] = c));
  let l;
  t[4] !== s || t[5] !== c
    ? ((l = (0, j.jsxs)(j.Fragment, { children: [`You're setting up `, s, ` with`, ` `, c, `.`] })),
      (t[4] = s),
      (t[5] = c),
      (t[6] = l))
    : (l = t[6]);
  let f;
  t[7] === o.error
    ? (f = t[8])
    : ((f =
        o.error &&
        (0, j.jsxs)(p, {
          variant: `destructive`,
          children: [
            (0, j.jsx)(h, { "aria-hidden": !0 }),
            (0, j.jsx)(d, { children: o.error.message }),
          ],
        })),
      (t[7] = o.error),
      (t[8] = f));
  let m;
  t[9] === o ? (m = t[10]) : ((m = () => o.mutate()), (t[9] = o), (t[10] = m));
  let _;
  t[11] === o.isPending
    ? (_ = t[12])
    : ((_ = o.isPending && (0, j.jsx)(g, { className: `animate-spin` })),
      (t[11] = o.isPending),
      (t[12] = _));
  let v = o.isPending ? `Verifying…` : `Verify email`,
    y;
  t[13] !== m || t[14] !== _ || t[15] !== v || t[16] !== o.isPending
    ? ((y = (0, j.jsxs)(a, {
        size: `lg`,
        className: `w-full rounded-full`,
        onClick: m,
        disabled: o.isPending,
        ref: u,
        children: [_, v],
      })),
      (t[13] = m),
      (t[14] = _),
      (t[15] = v),
      (t[16] = o.isPending),
      (t[17] = y))
    : (y = t[17]);
  let x;
  t[18] !== f || t[19] !== y
    ? ((x = (0, j.jsxs)(`div`, { className: `flex flex-col gap-6`, children: [f, y] })),
      (t[18] = f),
      (t[19] = y),
      (t[20] = x))
    : (x = t[20]);
  let C;
  return (
    t[21] !== l || t[22] !== x
      ? ((C = (0, j.jsx)(b, { title: `Verify your email`, description: l, children: x })),
        (t[21] = l),
        (t[22] = x),
        (t[23] = C))
      : (C = t[23]),
    C
  );
}
function L() {
  let e = (0, A.c)(3),
    t = _(),
    [n, r] = (0, k.useState)(!1),
    i;
  return (
    e[0] !== t || e[1] !== n
      ? ((i = (0, j.jsx)(T, {
          children: n
            ? (0, j.jsx)(E, { onContinue: () => void t({ to: `/products` }) })
            : (0, j.jsx)(R, { onSignedIn: () => r(!0) }),
        })),
        (e[0] = t),
        (e[1] = n),
        (e[2] = i))
      : (i = e[2]),
    i
  );
}
function R(e) {
  let t = (0, A.c)(17),
    { onSignedIn: n } = e,
    r;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((r = { from: `/verify-registration` }), (t[0] = r))
    : (r = t[0]);
  let { id: i, token: a } = v(r);
  (!i || !a) && y();
  let o, c, l;
  t[1] !== i || t[2] !== a
    ? ((o = { id: i, token: a }),
      (c = s),
      (l = w(o)),
      (t[1] = i),
      (t[2] = a),
      (t[3] = o),
      (t[4] = c),
      (t[5] = l))
    : ((o = t[3]), (c = t[4]), (l = t[5]));
  let { data: u } = c(l);
  if (u.completed) {
    let e;
    return (
      t[6] === u.shopCode
        ? (e = t[7])
        : ((e = (0, j.jsx)(F, { shopCode: u.shopCode })), (t[6] = u.shopCode), (t[7] = e)),
      e
    );
  }
  if (!u.verified) {
    let e;
    return (
      t[8] !== o || t[9] !== u.email || t[10] !== u.shopName
        ? ((e = (0, j.jsx)(I, { link: o, email: u.email, shopName: u.shopName })),
          (t[8] = o),
          (t[9] = u.email),
          (t[10] = u.shopName),
          (t[11] = e))
        : (e = t[11]),
      e
    );
  }
  let d;
  return (
    t[12] !== o || t[13] !== n || t[14] !== u.email || t[15] !== u.shopCode
      ? ((d = (0, j.jsx)(N, { link: o, email: u.email, shopCode: u.shopCode, onSignedIn: n })),
        (t[12] = o),
        (t[13] = n),
        (t[14] = u.email),
        (t[15] = u.shopCode),
        (t[16] = d))
      : (d = t[16]),
    d
  );
}
export { L as VerifyRegistrationScreen };
