import { Bt as e, Ht as t, _ as n, g as r } from "./createLucideIcon-BBeoGZx-.js";
import { a as i, c as a, i as o, n as s, o as c, r as l, s as u, t as d } from "./x-B76tEvwZ.js";
var f = n();
t();
var p = e();
function m(e) {
  let t = (0, f.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, p.jsx)(s, { "data-slot": `sheet`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function h(e) {
  let t = (0, f.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, p.jsx)(l, { "data-slot": `sheet-close`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function g(e) {
  let t = (0, f.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, p.jsx)(u, { "data-slot": `sheet-portal`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function _(e) {
  let t = (0, f.c)(8),
    n,
    i;
  t[0] === e
    ? ((n = t[1]), (i = t[2]))
    : (({ className: n, ...i } = e), (t[0] = e), (t[1] = n), (t[2] = i));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = r(
        `fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== i || t[6] !== a
      ? ((o = (0, p.jsx)(c, { "data-slot": `sheet-overlay`, className: a, ...i })),
        (t[5] = i),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function v(e) {
  let t = (0, f.c)(20),
    n,
    i,
    a,
    s,
    c;
  t[0] === e
    ? ((n = t[1]), (i = t[2]), (a = t[3]), (s = t[4]), (c = t[5]))
    : (({ className: i, children: n, side: s, showCloseButton: c, ...a } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = i),
      (t[3] = a),
      (t[4] = s),
      (t[5] = c));
  let u = s === void 0 ? `right` : s,
    m = c === void 0 || c,
    h;
  t[6] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((h = (0, p.jsx)(_, {})), (t[6] = h))
    : (h = t[6]);
  let v =
      u === `right` &&
      `inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm`,
    y =
      u === `left` &&
      `inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm`,
    b =
      u === `top` &&
      `inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top`,
    x =
      u === `bottom` &&
      `inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom`,
    S;
  t[7] !== i || t[8] !== v || t[9] !== y || t[10] !== b || t[11] !== x
    ? ((S = r(
        `fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500`,
        v,
        y,
        b,
        x,
        i,
      )),
      (t[7] = i),
      (t[8] = v),
      (t[9] = y),
      (t[10] = b),
      (t[11] = x),
      (t[12] = S))
    : (S = t[12]);
  let C;
  t[13] === m
    ? (C = t[14])
    : ((C =
        m &&
        (0, p.jsxs)(l, {
          className: `absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary`,
          children: [
            (0, p.jsx)(d, { className: `size-4` }),
            (0, p.jsx)(`span`, { className: `sr-only`, children: `Close` }),
          ],
        })),
      (t[13] = m),
      (t[14] = C));
  let w;
  return (
    t[15] !== n || t[16] !== a || t[17] !== S || t[18] !== C
      ? ((w = (0, p.jsxs)(g, {
          children: [
            h,
            (0, p.jsxs)(o, { "data-slot": `sheet-content`, className: S, ...a, children: [n, C] }),
          ],
        })),
        (t[15] = n),
        (t[16] = a),
        (t[17] = S),
        (t[18] = C),
        (t[19] = w))
      : (w = t[19]),
    w
  );
}
function y(e) {
  let t = (0, f.c)(8),
    n,
    i;
  t[0] === e
    ? ((n = t[1]), (i = t[2]))
    : (({ className: n, ...i } = e), (t[0] = e), (t[1] = n), (t[2] = i));
  let a;
  t[3] === n ? (a = t[4]) : ((a = r(`flex flex-col gap-1.5 p-4`, n)), (t[3] = n), (t[4] = a));
  let o;
  return (
    t[5] !== i || t[6] !== a
      ? ((o = (0, p.jsx)(`div`, { "data-slot": `sheet-header`, className: a, ...i })),
        (t[5] = i),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function b(e) {
  let t = (0, f.c)(8),
    n,
    i;
  t[0] === e
    ? ((n = t[1]), (i = t[2]))
    : (({ className: n, ...i } = e), (t[0] = e), (t[1] = n), (t[2] = i));
  let a;
  t[3] === n ? (a = t[4]) : ((a = r(`mt-auto flex flex-col gap-2 p-4`, n)), (t[3] = n), (t[4] = a));
  let o;
  return (
    t[5] !== i || t[6] !== a
      ? ((o = (0, p.jsx)(`div`, { "data-slot": `sheet-footer`, className: a, ...i })),
        (t[5] = i),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function x(e) {
  let t = (0, f.c)(8),
    n,
    i;
  t[0] === e
    ? ((n = t[1]), (i = t[2]))
    : (({ className: n, ...i } = e), (t[0] = e), (t[1] = n), (t[2] = i));
  let o;
  t[3] === n ? (o = t[4]) : ((o = r(`font-semibold text-foreground`, n)), (t[3] = n), (t[4] = o));
  let s;
  return (
    t[5] !== i || t[6] !== o
      ? ((s = (0, p.jsx)(a, { "data-slot": `sheet-title`, className: o, ...i })),
        (t[5] = i),
        (t[6] = o),
        (t[7] = s))
      : (s = t[7]),
    s
  );
}
function S(e) {
  let t = (0, f.c)(8),
    n,
    a;
  t[0] === e
    ? ((n = t[1]), (a = t[2]))
    : (({ className: n, ...a } = e), (t[0] = e), (t[1] = n), (t[2] = a));
  let o;
  t[3] === n ? (o = t[4]) : ((o = r(`text-sm text-muted-foreground`, n)), (t[3] = n), (t[4] = o));
  let s;
  return (
    t[5] !== a || t[6] !== o
      ? ((s = (0, p.jsx)(i, { "data-slot": `sheet-description`, className: o, ...a })),
        (t[5] = a),
        (t[6] = o),
        (t[7] = s))
      : (s = t[7]),
    s
  );
}
export { b as a, S as i, h as n, y as o, v as r, x as s, m as t };
