import { Bt as e, Ht as t, Wt as n, _ as r, u as i } from "./createLucideIcon-BBeoGZx-.js";
import { t as a } from "./link-BaidU34I.js";
import { t as o } from "./useSuspenseQuery-DGcWv8BO.js";
import { n as s, t as c } from "./text-BG7k3Olz.js";
import { n as l, r as u, t as d } from "./alert-BTZapdK4.js";
import { a as f, d as p } from "./field-BUpdDBSZ.js";
import { t as m } from "./loader-circle-4Q5UpSxt.js";
import {
  Ut as h,
  Wt as g,
  a as _,
  c as v,
  d as y,
  i as b,
  o as x,
  u as S,
} from "./index-DZbZvBMN.js";
import { t as C } from "./success-DWWCnAdt.js";
import { i as w, r as T } from "./onboarding-c8b95Dmh.js";
var E = n(t(), 1),
  D = r(),
  O = e();
function k(e) {
  let t = (0, D.c)(43),
    { link: n, preview: r, onJoined: o } = e,
    h = x(n, r, o),
    g = r.existingAccount,
    v;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((v = { name: ``, password: `` }), (t[0] = v))
    : (v = t[0]);
  let b = g ? T : w,
    S;
  t[1] === b ? (S = t[2]) : ((S = { onSubmit: b }), (t[1] = b), (t[2] = S));
  let C;
  t[3] === h
    ? (C = t[4])
    : ((C = (e) => {
        let { value: t } = e;
        return h.mutate({ ...t });
      }),
      (t[3] = h),
      (t[4] = C));
  let E;
  t[5] !== S || t[6] !== C
    ? ((E = { defaultValues: v, validators: S, onSubmit: C, onSubmitInvalid: u }),
      (t[5] = S),
      (t[6] = C),
      (t[7] = E))
    : (E = t[7]);
  let k = s(E),
    j = h.error,
    M = `Join ${r.shopName}`,
    N;
  t[8] !== g || t[9] !== r.email || t[10] !== r.roleName
    ? ((N = g
        ? (0, O.jsxs)(O.Fragment, {
            children: [
              `Sign in as `,
              (0, O.jsx)(`strong`, { className: `text-foreground`, children: r.email }),
              ` to join as`,
              ` `,
              (0, O.jsx)(`strong`, { className: `text-foreground`, children: r.roleName }),
              `. Your password stays the same.`,
            ],
          })
        : (0, O.jsxs)(O.Fragment, {
            children: [
              `You've been invited as `,
              (0, O.jsx)(`strong`, { className: `text-foreground`, children: r.roleName }),
              ` `,
              `with `,
              (0, O.jsx)(`strong`, { className: `text-foreground`, children: r.email }),
              `. Add your name and choose a password.`,
            ],
          })),
      (t[8] = g),
      (t[9] = r.email),
      (t[10] = r.roleName),
      (t[11] = N))
    : (N = t[11]);
  let P;
  t[12] === k
    ? (P = t[13])
    : ((P = (e) => {
        (e.preventDefault(), k.handleSubmit());
      }),
      (t[12] = k),
      (t[13] = P));
  let F;
  t[14] !== g || t[15] !== k.Field
    ? ((F = !g && (0, O.jsx)(k.Field, { name: `name`, children: A })),
      (t[14] = g),
      (t[15] = k.Field),
      (t[16] = F))
    : (F = t[16]);
  let I;
  t[17] === g
    ? (I = t[18])
    : ((I = (e) =>
        (0, O.jsx)(c, {
          field: e,
          label: `Password`,
          type: `password`,
          autoFocus: g,
          autoComplete: g ? `current-password` : `new-password`,
          description: g ? void 0 : `At least 12 characters.`,
        })),
      (t[17] = g),
      (t[18] = I));
  let L;
  t[19] !== k.Field || t[20] !== I
    ? ((L = (0, O.jsx)(k.Field, { name: `password`, children: I })),
      (t[19] = k.Field),
      (t[20] = I),
      (t[21] = L))
    : (L = t[21]);
  let R;
  t[22] !== L || t[23] !== F
    ? ((R = (0, O.jsxs)(f, { className: `gap-6`, children: [F, L] })),
      (t[22] = L),
      (t[23] = F),
      (t[24] = R))
    : (R = t[24]);
  let z;
  t[25] !== j || t[26] !== r.shopCode
    ? ((z =
        j &&
        (0, O.jsxs)(d, {
          variant: `destructive`,
          children: [
            (0, O.jsx)(p, { "aria-hidden": !0 }),
            (0, O.jsxs)(l, {
              children: [
                _(j)
                  ? `You've joined, but we couldn't log you in: ${j.message}. `
                  : `${j.message} `,
                _(j) &&
                  (0, O.jsx)(a, {
                    to: `/login`,
                    search: { shop: r.shopCode },
                    className: `underline`,
                    children: `Log in`,
                  }),
              ],
            }),
          ],
        })),
      (t[25] = j),
      (t[26] = r.shopCode),
      (t[27] = z))
    : (z = t[27]);
  let B;
  t[28] === h.isPending
    ? (B = t[29])
    : ((B = h.isPending && (0, O.jsx)(m, { className: `animate-spin` })),
      (t[28] = h.isPending),
      (t[29] = B));
  let V = h.isPending ? `Joining…` : g ? `Sign in and join` : `Create account and join`,
    H;
  t[30] !== h.isPending || t[31] !== B || t[32] !== V
    ? ((H = (0, O.jsxs)(i, {
        type: `submit`,
        size: `lg`,
        className: `w-full rounded-full`,
        disabled: h.isPending,
        children: [B, V],
      })),
      (t[30] = h.isPending),
      (t[31] = B),
      (t[32] = V),
      (t[33] = H))
    : (H = t[33]);
  let U;
  t[34] !== R || t[35] !== z || t[36] !== H || t[37] !== P
    ? ((U = (0, O.jsxs)(`form`, {
        noValidate: !0,
        className: `flex flex-col gap-9`,
        onSubmit: P,
        children: [R, z, H],
      })),
      (t[34] = R),
      (t[35] = z),
      (t[36] = H),
      (t[37] = P),
      (t[38] = U))
    : (U = t[38]);
  let W;
  return (
    t[39] !== U || t[40] !== M || t[41] !== N
      ? ((W = (0, O.jsx)(y, { title: M, description: N, children: U })),
        (t[39] = U),
        (t[40] = M),
        (t[41] = N),
        (t[42] = W))
      : (W = t[42]),
    W
  );
}
function A(e) {
  return (0, O.jsx)(c, { field: e, label: `Your name`, autoFocus: !0, autoComplete: `name` });
}
function j() {
  let e = (0, D.c)(3),
    t = h(),
    [n, r] = (0, E.useState)(!1),
    i;
  return (
    e[0] !== n || e[1] !== t
      ? ((i = (0, O.jsx)(S, {
          children: n
            ? (0, O.jsx)(C, { onContinue: () => void t({ to: `/products` }) })
            : (0, O.jsx)(M, { onJoined: () => r(!0) }),
        })),
        (e[0] = n),
        (e[1] = t),
        (e[2] = i))
      : (i = e[2]),
    i
  );
}
function M(e) {
  let t = (0, D.c)(10),
    { onJoined: n } = e,
    r;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((r = { from: `/accept-invitation` }), (t[0] = r))
    : (r = t[0]);
  let { id: i, token: a } = g(r);
  (!i || !a) && v();
  let s, c, l;
  t[1] !== i || t[2] !== a
    ? ((s = { id: i, token: a }),
      (c = o),
      (l = b(s)),
      (t[1] = i),
      (t[2] = a),
      (t[3] = s),
      (t[4] = c),
      (t[5] = l))
    : ((s = t[3]), (c = t[4]), (l = t[5]));
  let { data: u } = c(l),
    d;
  return (
    t[6] !== s || t[7] !== n || t[8] !== u
      ? ((d = (0, O.jsx)(k, { link: s, preview: u, onJoined: n })),
        (t[6] = s),
        (t[7] = n),
        (t[8] = u),
        (t[9] = d))
      : (d = t[9]),
    d
  );
}
export { j as AcceptInvitationScreen };
