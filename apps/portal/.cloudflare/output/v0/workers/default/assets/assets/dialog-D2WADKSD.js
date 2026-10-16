import { Bt as e, _ as t, u as n } from "./createLucideIcon-BBeoGZx-.js";
import { n as r, t as i } from "./alert-BTZapdK4.js";
import { d as a } from "./field-BUpdDBSZ.js";
import { st as o } from "./index-DZbZvBMN.js";
import { i as s, n as c, t as l } from "./online-B_7Uj1Wv.js";
import { a as u, i as d, n as f, o as p, r as m, s as h, t as g } from "./dialog-CiSY6Yg1.js";
var _ = t(),
  v = e(),
  y = `confirm-blocked`;
function b(e) {
  let t = (0, _.c)(40),
    {
      open: b,
      onOpenChange: x,
      title: S,
      description: C,
      confirmLabel: w,
      blocked: T,
      error: E,
      pending: D,
    } = e,
    O = l(),
    k = O && !D && !T,
    A;
  t[0] !== k || t[1] !== e
    ? ((A = {
        "Mod+Enter": () => {
          k && e.onConfirm();
        },
      }),
      (t[0] = k),
      (t[1] = e),
      (t[2] = A))
    : (A = t[2]);
  let j = s(A),
    M;
  t[3] === e
    ? (M = t[4])
    : ((M = (t) => {
        (t.preventDefault(), e.restoreFocus());
      }),
      (t[3] = e),
      (t[4] = M));
  let N;
  t[5] === S ? (N = t[6]) : ((N = (0, v.jsx)(h, { children: S })), (t[5] = S), (t[6] = N));
  let P;
  t[7] === C ? (P = t[8]) : ((P = (0, v.jsx)(d, { children: C })), (t[7] = C), (t[8] = P));
  let F;
  t[9] !== N || t[10] !== P
    ? ((F = (0, v.jsxs)(p, { children: [N, P] })), (t[9] = N), (t[10] = P), (t[11] = F))
    : (F = t[11]);
  let I;
  t[12] === T
    ? (I = t[13])
    : ((I =
        T && (0, v.jsx)(`p`, { id: y, className: `text-sm text-muted-foreground`, children: T })),
      (t[12] = T),
      (t[13] = I));
  let L;
  t[14] === O
    ? (L = t[15])
    : ((L =
        !O &&
        (0, v.jsx)(`p`, {
          className: `text-sm text-muted-foreground`,
          children: `You're offline. Reconnect to continue.`,
        })),
      (t[14] = O),
      (t[15] = L));
  let R;
  t[16] === E
    ? (R = t[17])
    : ((R =
        E &&
        (0, v.jsxs)(i, {
          variant: `destructive`,
          children: [(0, v.jsx)(a, { "aria-hidden": !0 }), (0, v.jsx)(r, { children: E })],
        })),
      (t[16] = E),
      (t[17] = R));
  let z;
  t[18] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((z = (0, v.jsx)(f, {
        asChild: !0,
        children: (0, v.jsx)(n, { variant: `outline`, children: `Cancel` }),
      })),
      (t[18] = z))
    : (z = t[18]);
  let B = e.destructive === !1 ? `default` : `destructive`,
    V = !k,
    H = T ? y : void 0,
    U = D ? `Working…` : w,
    W;
  t[19] === D
    ? (W = t[20])
    : ((W = !D && (0, v.jsxs)(o, { "aria-hidden": !0, children: [c, ` ↵`] })),
      (t[19] = D),
      (t[20] = W));
  let G;
  t[21] !== e.onConfirm || t[22] !== V || t[23] !== H || t[24] !== U || t[25] !== W || t[26] !== B
    ? ((G = (0, v.jsxs)(u, {
        children: [
          z,
          (0, v.jsxs)(n, {
            variant: B,
            disabled: V,
            "aria-describedby": H,
            onClick: e.onConfirm,
            children: [U, W],
          }),
        ],
      })),
      (t[21] = e.onConfirm),
      (t[22] = V),
      (t[23] = H),
      (t[24] = U),
      (t[25] = W),
      (t[26] = B),
      (t[27] = G))
    : (G = t[27]);
  let K;
  t[28] !== j ||
  t[29] !== M ||
  t[30] !== G ||
  t[31] !== F ||
  t[32] !== I ||
  t[33] !== L ||
  t[34] !== R
    ? ((K = (0, v.jsxs)(m, { ref: j, onCloseAutoFocus: M, children: [F, I, L, R, G] })),
      (t[28] = j),
      (t[29] = M),
      (t[30] = G),
      (t[31] = F),
      (t[32] = I),
      (t[33] = L),
      (t[34] = R),
      (t[35] = K))
    : (K = t[35]);
  let q;
  return (
    t[36] !== x || t[37] !== b || t[38] !== K
      ? ((q = (0, v.jsx)(g, { open: b, onOpenChange: x, children: K })),
        (t[36] = x),
        (t[37] = b),
        (t[38] = K),
        (t[39] = q))
      : (q = t[39]),
    q
  );
}
export { b as t };
