import { Bt as e, Ht as t, Wt as n, _ as r, u as i } from "./createLucideIcon-BBeoGZx-.js";
import { st as a } from "./index-DZbZvBMN.js";
import { n as o } from "./online-B_7Uj1Wv.js";
import { a as s, i as c, n as l, o as u, r as d, s as f, t as p } from "./sheet-rEE2xq8n.js";
var m = r(),
  h = e();
function g(e) {
  let t = (0, m.c)(18),
    {
      open: n,
      onOpenChange: r,
      title: i,
      description: a,
      restoreFocus: o,
      children: s,
      className: l,
    } = e,
    g = l ?? `sm:max-w-md`,
    _;
  t[0] === o
    ? (_ = t[1])
    : ((_ = (e) => {
        (e.preventDefault(), o());
      }),
      (t[0] = o),
      (t[1] = _));
  let v;
  t[2] === i ? (v = t[3]) : ((v = (0, h.jsx)(f, { children: i })), (t[2] = i), (t[3] = v));
  let y;
  t[4] === a ? (y = t[5]) : ((y = (0, h.jsx)(c, { children: a })), (t[4] = a), (t[5] = y));
  let b;
  t[6] !== v || t[7] !== y
    ? ((b = (0, h.jsxs)(u, { children: [v, y] })), (t[6] = v), (t[7] = y), (t[8] = b))
    : (b = t[8]);
  let x;
  t[9] !== s || t[10] !== g || t[11] !== _ || t[12] !== b
    ? ((x = (0, h.jsxs)(d, { className: g, onCloseAutoFocus: _, children: [b, s] })),
      (t[9] = s),
      (t[10] = g),
      (t[11] = _),
      (t[12] = b),
      (t[13] = x))
    : (x = t[13]);
  let S;
  return (
    t[14] !== r || t[15] !== n || t[16] !== x
      ? ((S = (0, h.jsx)(p, { open: n, onOpenChange: r, children: x })),
        (t[14] = r),
        (t[15] = n),
        (t[16] = x),
        (t[17] = S))
      : (S = t[17]),
    S
  );
}
var _ = `save-offline-note`;
function v(e) {
  let t = (0, m.c)(14),
    { label: n, pendingLabel: r, pending: c, online: u } = e,
    d = r === void 0 ? `Saving…` : r,
    f;
  t[0] === u
    ? (f = t[1])
    : ((f =
        !u &&
        (0, h.jsx)(`p`, {
          id: _,
          className: `px-4 text-sm text-muted-foreground`,
          children: `You're offline. Reconnect to save.`,
        })),
      (t[0] = u),
      (t[1] = f));
  let p;
  t[2] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((p = (0, h.jsx)(l, {
        asChild: !0,
        children: (0, h.jsx)(i, { type: `button`, variant: `outline`, children: `Cancel` }),
      })),
      (t[2] = p))
    : (p = t[2]);
  let g = !u || c,
    v = u ? void 0 : _,
    y;
  t[3] !== n || t[4] !== c || t[5] !== d
    ? ((y = c
        ? d
        : (0, h.jsxs)(h.Fragment, {
            children: [n, (0, h.jsxs)(a, { "aria-hidden": !0, children: [o, ` ↵`] })],
          })),
      (t[3] = n),
      (t[4] = c),
      (t[5] = d),
      (t[6] = y))
    : (y = t[6]);
  let b;
  t[7] !== g || t[8] !== v || t[9] !== y
    ? ((b = (0, h.jsxs)(s, {
        className: `flex-col-reverse sm:flex-row sm:justify-end`,
        children: [
          p,
          (0, h.jsx)(i, { type: `submit`, disabled: g, "aria-describedby": v, children: y }),
        ],
      })),
      (t[7] = g),
      (t[8] = v),
      (t[9] = y),
      (t[10] = b))
    : (b = t[10]);
  let x;
  return (
    t[11] !== f || t[12] !== b
      ? ((x = (0, h.jsxs)(h.Fragment, { children: [f, b] })), (t[11] = f), (t[12] = b), (t[13] = x))
      : (x = t[13]),
    x
  );
}
function y({ title: e, action: t, children: n }) {
  return (0, h.jsxs)(`div`, {
    className: `flex items-center justify-between gap-4`,
    children: [
      (0, h.jsx)(`h1`, { className: `text-3xl font-bold tracking-tight`, children: e }),
      (0, h.jsxs)(`div`, {
        className: `flex items-center gap-3`,
        children: [
          n,
          t &&
            (0, h.jsxs)(i, {
              ref: t.ref,
              onClick: t.onClick,
              children: [t.label, (0, h.jsx)(a, { "aria-hidden": !0, children: t.shortcut })],
            }),
        ],
      }),
    ],
  });
}
var b = (e) => `edit-${e}`,
  x = (e) => `delete-${e}`;
function S(e) {
  let t = (0, m.c)(11),
    { name: n, id: r, onEdit: a, onDelete: o } = e,
    s;
  t[0] !== r || t[1] !== n || t[2] !== a
    ? ((s =
        a &&
        (0, h.jsx)(i, {
          id: b(r),
          variant: `outline`,
          size: `sm`,
          "aria-label": `Edit ${n}`,
          onClick: a,
          children: `Edit`,
        })),
      (t[0] = r),
      (t[1] = n),
      (t[2] = a),
      (t[3] = s))
    : (s = t[3]);
  let c;
  t[4] !== r || t[5] !== n || t[6] !== o
    ? ((c =
        o &&
        (0, h.jsx)(i, {
          id: x(r),
          variant: `outline`,
          size: `sm`,
          "aria-label": `Delete ${n}`,
          onClick: o,
          children: `Delete`,
        })),
      (t[4] = r),
      (t[5] = n),
      (t[6] = o),
      (t[7] = c))
    : (c = t[7]);
  let l;
  return (
    t[8] !== s || t[9] !== c
      ? ((l = (0, h.jsxs)(`div`, {
          className: `flex justify-end gap-2`,
          onFocusCapture: C,
          children: [s, c],
        })),
        (t[8] = s),
        (t[9] = c),
        (t[10] = l))
      : (l = t[10]),
    l
  );
}
function C(e) {
  e.target instanceof HTMLButtonElement &&
    e.target.scrollIntoView({ block: `nearest`, inline: `nearest` });
}
var w = n(t(), 1);
function T(e, t) {
  (document.getElementById(e ?? ``) ?? t.current)?.focus();
}
function E(e) {
  let t = (0, m.c)(10),
    n;
  t[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((n = { open: !1 }), (t[0] = n)) : (n = t[0]);
  let [r, i] = (0, w.useState)(n),
    a,
    o;
  t[1] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = (e, t) => i({ open: !0, value: e, trigger: t })),
      (o = (e) => i((t) => ({ ...t, open: e }))),
      (t[1] = a),
      (t[2] = o))
    : ((a = t[1]), (o = t[2]));
  let s;
  t[3] !== e || t[4] !== r.trigger
    ? ((s = () => T(r.trigger, e)), (t[3] = e), (t[4] = r.trigger), (t[5] = s))
    : (s = t[5]);
  let c;
  return (
    t[6] !== r.open || t[7] !== r.value || t[8] !== s
      ? ((c = { open: r.open, value: r.value, show: a, setOpen: o, restoreFocus: s }),
        (t[6] = r.open),
        (t[7] = r.value),
        (t[8] = s),
        (t[9] = c))
      : (c = t[9]),
    c
  );
}
export { y as a, b as i, S as n, v as o, x as r, g as s, E as t };
