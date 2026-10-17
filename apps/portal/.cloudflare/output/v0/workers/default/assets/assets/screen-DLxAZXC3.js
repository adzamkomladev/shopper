import {
  $ as e,
  Bt as t,
  Ht as n,
  R as r,
  Wt as i,
  _ as a,
  st as o,
  u as s,
  zt as c,
} from "./createLucideIcon-BBeoGZx-.js";
import { t as l } from "./link-BaidU34I.js";
import { t as u } from "./queryOptions-BmBcu1YJ.js";
import { t as d } from "./useQuery-DCYgzPRk.js";
import { n as f, t as p } from "./text-BG7k3Olz.js";
import { a as m, n as h, r as g, t as _ } from "./alert-BTZapdK4.js";
import { a as v, d as y } from "./field-BUpdDBSZ.js";
import { t as b } from "./loader-circle-4Q5UpSxt.js";
import { v as x, y as S } from "./schemas-DTb5O009.js";
import { d as C, l as w, u as T } from "./index-DZbZvBMN.js";
import { a as E, o as D, t as O } from "./onboarding-c8b95Dmh.js";
var k = i(n(), 1),
  A = a(),
  j = r({ id: e() });
function M(e) {
  let t = (0, A.c)(2),
    n;
  return (
    t[0] === e
      ? (n = t[1])
      : ((n = {
          gcTime: 0,
          mutationFn: async (t) => {
            e(await w(`/onboarding/start`, x, { method: `POST`, body: t }));
          },
        }),
        (t[0] = e),
        (t[1] = n)),
    o(n)
  );
}
function N({ id: e, resendToken: t }) {
  return u({
    queryKey: [`registration-delivery`, e],
    queryFn: async () =>
      (await w(`/onboarding/${e}?resendToken=${encodeURIComponent(t)}`, S)).deliveryStatus ??
      `pending`,
    retry: !1,
  });
}
function P(e) {
  let t = (0, A.c)(9),
    { id: n, resendToken: r } = e,
    i = c(),
    a;
  t[0] !== n || t[1] !== r
    ? ((a = () => w(`/onboarding/${n}/resend`, j, { method: `POST`, body: { resendToken: r } })),
      (t[0] = n),
      (t[1] = r),
      (t[2] = a))
    : (a = t[2]);
  let s;
  t[3] !== n || t[4] !== i
    ? ((s = () => i.invalidateQueries({ queryKey: [`registration-delivery`, n] })),
      (t[3] = n),
      (t[4] = i),
      (t[5] = s))
    : (s = t[5]);
  let l;
  return (
    t[6] !== a || t[7] !== s
      ? ((l = { gcTime: 0, mutationFn: a, onSuccess: s }), (t[6] = a), (t[7] = s), (t[8] = l))
      : (l = t[8]),
    o(l)
  );
}
var F = t();
function I(e) {
  let t = (0, A.c)(42),
    { started: n, onChangeEmail: r } = e,
    i;
  t[0] === n ? (i = t[1]) : ((i = N(n)), (t[0] = n), (t[1] = i));
  let a;
  t[2] !== n.deliveryStatus || t[3] !== i
    ? ((a = { ...i, initialData: n.deliveryStatus }),
      (t[2] = n.deliveryStatus),
      (t[3] = i),
      (t[4] = a))
    : (a = t[4]);
  let o = d(a),
    c = P(n),
    l = o.data,
    u;
  t[5] === n.email
    ? (u = t[6])
    : ((u = (0, F.jsxs)(F.Fragment, {
        children: [
          `We sent a link to `,
          (0, F.jsx)(`strong`, { className: `text-foreground`, children: n.email }),
          `. Open it to confirm it's you. The link works for 24 hours.`,
        ],
      })),
      (t[5] = n.email),
      (t[6] = u));
  let f;
  t[7] === l
    ? (f = t[8])
    : ((f =
        l === `failed` &&
        (0, F.jsxs)(_, {
          variant: `destructive`,
          children: [
            (0, F.jsx)(y, { "aria-hidden": !0 }),
            (0, F.jsx)(h, {
              children: `We couldn't send the email. Resend it, or go back and check the address.`,
            }),
          ],
        })),
      (t[7] = l),
      (t[8] = f));
  let p = l === `pending` && `Sending the email…`,
    g = l === `sent` && `The email was sent.`,
    v = c.isSuccess && ` Another email is on its way. It can take a minute to arrive.`,
    x;
  t[9] !== p || t[10] !== g || t[11] !== v
    ? ((x = (0, F.jsxs)(`p`, {
        role: `status`,
        className: `text-sm text-muted-foreground`,
        children: [p, g, v],
      })),
      (t[9] = p),
      (t[10] = g),
      (t[11] = v),
      (t[12] = x))
    : (x = t[12]);
  let S;
  t[13] === c.error
    ? (S = t[14])
    : ((S =
        c.error &&
        (0, F.jsxs)(_, {
          variant: `destructive`,
          children: [
            (0, F.jsx)(y, { "aria-hidden": !0 }),
            (0, F.jsx)(h, { children: c.error.message }),
          ],
        })),
      (t[13] = c.error),
      (t[14] = S));
  let w;
  t[15] === c ? (w = t[16]) : ((w = () => c.mutate()), (t[15] = c), (t[16] = w));
  let T;
  t[17] === c.isPending
    ? (T = t[18])
    : ((T = c.isPending && (0, F.jsx)(b, { className: `animate-spin` })),
      (t[17] = c.isPending),
      (t[18] = T));
  let E;
  t[19] !== c.isPending || t[20] !== w || t[21] !== T
    ? ((E = (0, F.jsxs)(s, {
        size: `lg`,
        className: `rounded-full sm:flex-1`,
        onClick: w,
        disabled: c.isPending,
        ref: m,
        children: [T, `Resend email`],
      })),
      (t[19] = c.isPending),
      (t[20] = w),
      (t[21] = T),
      (t[22] = E))
    : (E = t[22]);
  let D;
  t[23] === o ? (D = t[24]) : ((D = () => void o.refetch()), (t[23] = o), (t[24] = D));
  let O;
  t[25] !== o.isFetching || t[26] !== D
    ? ((O = (0, F.jsx)(s, {
        size: `lg`,
        variant: `outline`,
        className: `rounded-full sm:flex-1`,
        onClick: D,
        disabled: o.isFetching,
        children: `Check delivery`,
      })),
      (t[25] = o.isFetching),
      (t[26] = D),
      (t[27] = O))
    : (O = t[27]);
  let k;
  t[28] !== E || t[29] !== O
    ? ((k = (0, F.jsxs)(`div`, { className: `flex flex-col gap-4 sm:flex-row`, children: [E, O] })),
      (t[28] = E),
      (t[29] = O),
      (t[30] = k))
    : (k = t[30]);
  let j;
  t[31] === r
    ? (j = t[32])
    : ((j = (0, F.jsx)(s, {
        variant: `link`,
        className: `self-start px-0`,
        onClick: r,
        children: `Use a different email`,
      })),
      (t[31] = r),
      (t[32] = j));
  let M;
  t[33] !== k || t[34] !== j || t[35] !== f || t[36] !== x || t[37] !== S
    ? ((M = (0, F.jsxs)(`div`, { className: `flex flex-col gap-6`, children: [f, x, S, k, j] })),
      (t[33] = k),
      (t[34] = j),
      (t[35] = f),
      (t[36] = x),
      (t[37] = S),
      (t[38] = M))
    : (M = t[38]);
  let I;
  return (
    t[39] !== M || t[40] !== u
      ? ((I = (0, F.jsx)(C, { title: `Check your email`, description: u, children: M })),
        (t[39] = M),
        (t[40] = u),
        (t[41] = I))
      : (I = t[41]),
    I
  );
}
function L(e) {
  let t = (0, A.c)(38),
    { onStarted: n } = e,
    r = M(n),
    i = (0, k.useRef)(!1),
    a,
    o;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = { name: ``, email: ``, shopName: ``, shopCode: `` }),
      (o = { onSubmit: E }),
      (t[0] = a),
      (t[1] = o))
    : ((a = t[0]), (o = t[1]));
  let c;
  t[2] === r
    ? (c = t[3])
    : ((c = {
        defaultValues: a,
        validators: o,
        onSubmit: (e) => {
          let { value: t } = e;
          return r.mutate(t);
        },
        onSubmitInvalid: g,
      }),
      (t[2] = r),
      (t[3] = c));
  let u = f(c),
    d;
  t[4] === u
    ? (d = t[5])
    : ((d = (e) => {
        (e.preventDefault(), u.handleSubmit());
      }),
      (t[4] = u),
      (t[5] = d));
  let m, x;
  t[6] === u.Field
    ? ((m = t[7]), (x = t[8]))
    : ((m = (0, F.jsx)(u.Field, { name: `name`, children: z })),
      (x = (0, F.jsx)(u.Field, { name: `email`, children: R })),
      (t[6] = u.Field),
      (t[7] = m),
      (t[8] = x));
  let S;
  t[9] === u
    ? (S = t[10])
    : ((S = (e) =>
        (0, F.jsx)(p, {
          field: e,
          label: `Shop name`,
          autoComplete: `organization`,
          onChange: (e) => {
            i.current || u.setFieldValue(`shopCode`, D(e.target.value));
          },
        })),
      (t[9] = u),
      (t[10] = S));
  let w;
  t[11] !== u.Field || t[12] !== S
    ? ((w = (0, F.jsx)(u.Field, { name: `shopName`, children: S })),
      (t[11] = u.Field),
      (t[12] = S),
      (t[13] = w))
    : (w = t[13]);
  let T;
  t[14] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((T = (e) =>
        (0, F.jsx)(p, {
          field: e,
          label: `Shop code`,
          description: O,
          autoCapitalize: `none`,
          spellCheck: !1,
          onChange: () => {
            i.current = !0;
          },
        })),
      (t[14] = T))
    : (T = t[14]);
  let j;
  t[15] === u.Field
    ? (j = t[16])
    : ((j = (0, F.jsx)(u.Field, { name: `shopCode`, children: T })),
      (t[15] = u.Field),
      (t[16] = j));
  let N;
  t[17] !== j || t[18] !== m || t[19] !== x || t[20] !== w
    ? ((N = (0, F.jsxs)(v, { className: `gap-6`, children: [m, x, w, j] })),
      (t[17] = j),
      (t[18] = m),
      (t[19] = x),
      (t[20] = w),
      (t[21] = N))
    : (N = t[21]);
  let P;
  t[22] === r.error
    ? (P = t[23])
    : ((P =
        r.error &&
        (0, F.jsxs)(_, {
          variant: `destructive`,
          children: [
            (0, F.jsx)(y, { "aria-hidden": !0 }),
            (0, F.jsx)(h, { children: r.error.message }),
          ],
        })),
      (t[22] = r.error),
      (t[23] = P));
  let I;
  t[24] === r.isPending
    ? (I = t[25])
    : ((I = r.isPending && (0, F.jsx)(b, { className: `animate-spin` })),
      (t[24] = r.isPending),
      (t[25] = I));
  let L = r.isPending ? `Sending the link…` : `Continue`,
    B;
  t[26] !== r.isPending || t[27] !== I || t[28] !== L
    ? ((B = (0, F.jsxs)(s, {
        type: `submit`,
        size: `lg`,
        className: `w-full rounded-full`,
        disabled: r.isPending,
        children: [I, L],
      })),
      (t[26] = r.isPending),
      (t[27] = I),
      (t[28] = L),
      (t[29] = B))
    : (B = t[29]);
  let V;
  t[30] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((V = (0, F.jsxs)(`p`, {
        className: `text-center text-sm text-muted-foreground`,
        children: [
          `Already have a shop?`,
          ` `,
          (0, F.jsx)(l, {
            to: `/login`,
            className: `font-medium text-primary underline-offset-4 hover:underline`,
            children: `Log in`,
          }),
        ],
      })),
      (t[30] = V))
    : (V = t[30]);
  let H;
  t[31] === B
    ? (H = t[32])
    : ((H = (0, F.jsxs)(`div`, { className: `flex flex-col gap-4`, children: [B, V] })),
      (t[31] = B),
      (t[32] = H));
  let U;
  return (
    t[33] !== N || t[34] !== P || t[35] !== H || t[36] !== d
      ? ((U = (0, F.jsx)(C, {
          title: `Create your shop`,
          description: `Tell us who you are and what to call your shop. We'll email you a link to confirm it's you.`,
          children: (0, F.jsxs)(`form`, {
            noValidate: !0,
            className: `flex flex-col gap-9`,
            onSubmit: d,
            children: [N, P, H],
          }),
        })),
        (t[33] = N),
        (t[34] = P),
        (t[35] = H),
        (t[36] = d),
        (t[37] = U))
      : (U = t[37]),
    U
  );
}
function R(e) {
  return (0, F.jsx)(p, { field: e, label: `Email`, type: `email`, autoComplete: `email` });
}
function z(e) {
  return (0, F.jsx)(p, { field: e, label: `Your name`, autoFocus: !0, autoComplete: `name` });
}
function B() {
  let e = (0, A.c)(2),
    [t, n] = (0, k.useState)(null),
    r;
  return (
    e[0] === t
      ? (r = e[1])
      : ((r = (0, F.jsx)(T, {
          children: t
            ? (0, F.jsx)(I, { started: t, onChangeEmail: () => n(null) })
            : (0, F.jsx)(L, { onStarted: n }),
        })),
        (e[0] = t),
        (e[1] = r)),
    r
  );
}
export { B as SignupScreen };
