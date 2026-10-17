import {
  Bt as e,
  Ht as t,
  Wt as n,
  _ as r,
  g as i,
  h as a,
  t as o,
} from "./createLucideIcon-BBeoGZx-.js";
import { o as s } from "./alert-BTZapdK4.js";
var c = n(t(), 1),
  l = e(),
  u = Object.defineProperty,
  d = c.forwardRef(
    ((e, t) => u(e, `name`, { value: t, configurable: !0 }))(function (e, t) {
      return (0, l.jsx)(s.label, {
        ...e,
        ref: t,
        onMouseDown: (t) => {
          t.target.closest(`button, input, select, textarea`) ||
            (e.onMouseDown?.(t), !t.defaultPrevented && t.detail > 1 && t.preventDefault());
        },
      });
    }, `Label`),
  ),
  f = Object.defineProperty,
  p = (e, t) => f(e, `name`, { value: t, configurable: !0 }),
  m = { Horizontal: `horizontal`, Vertical: `vertical` },
  h = m.Horizontal,
  g = Object.values(m),
  _ = c.forwardRef(
    p(function (e, t) {
      let { decorative: n, orientation: r = h, ...i } = e,
        a = v(r) ? r : h,
        o = a === m.Vertical ? a : void 0,
        c = n ? { role: `none` } : { "aria-orientation": o, role: `separator` };
      return (0, l.jsx)(s.div, { "data-orientation": a, ...c, ...i, ref: t });
    }, `Separator`),
  );
function v(e) {
  return g.includes(e);
}
p(v, `isValidOrientation`);
var y = {
  name: `circle-alert`,
  size: 24,
  node: [
    [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
    [`line`, { x1: `12`, x2: `12`, y1: `8`, y2: `12`, key: `1pkeuh` }],
    [`line`, { x1: `12`, x2: `12.01`, y1: `16`, y2: `16`, key: `4dfq90` }],
  ],
  aliases: [`alert-circle`],
};
y.node;
var b = o(y),
  x = r();
function S(e) {
  let t = (0, x.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(
        `flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== r || t[6] !== a
      ? ((o = (0, l.jsx)(d, { "data-slot": `label`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function C(e) {
  let t = (0, x.c)(12),
    n,
    r,
    a,
    o;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (a = t[3]), (o = t[4]))
    : (({ className: n, orientation: a, decorative: o, ...r } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = a),
      (t[4] = o));
  let s = a === void 0 ? `horizontal` : a,
    c = o === void 0 || o,
    u;
  t[5] === n
    ? (u = t[6])
    : ((u = i(
        `shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px`,
        n,
      )),
      (t[5] = n),
      (t[6] = u));
  let d;
  return (
    t[7] !== c || t[8] !== s || t[9] !== r || t[10] !== u
      ? ((d = (0, l.jsx)(_, {
          "data-slot": `separator`,
          decorative: c,
          orientation: s,
          className: u,
          ...r,
        })),
        (t[7] = c),
        (t[8] = s),
        (t[9] = r),
        (t[10] = u),
        (t[11] = d))
      : (d = t[11]),
    d
  );
}
function w(e) {
  let t = (0, x.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(
        `flex flex-col gap-6`,
        `has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== r || t[6] !== a
      ? ((o = (0, l.jsx)(`fieldset`, { "data-slot": `field-set`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function T(e) {
  let t = (0, x.c)(10),
    n,
    r,
    a;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (a = t[3]))
    : (({ className: n, variant: a, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = a));
  let o = a === void 0 ? `legend` : a,
    s;
  t[4] === n
    ? (s = t[5])
    : ((s = i(
        `mb-3 font-medium`,
        `data-[variant=legend]:text-base`,
        `data-[variant=label]:text-sm`,
        n,
      )),
      (t[4] = n),
      (t[5] = s));
  let c;
  return (
    t[6] !== r || t[7] !== s || t[8] !== o
      ? ((c = (0, l.jsx)(`legend`, {
          "data-slot": `field-legend`,
          "data-variant": o,
          className: s,
          ...r,
        })),
        (t[6] = r),
        (t[7] = s),
        (t[8] = o),
        (t[9] = c))
      : (c = t[9]),
    c
  );
}
function E(e) {
  let t = (0, x.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(
        `group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== r || t[6] !== a
      ? ((o = (0, l.jsx)(`div`, { "data-slot": `field-group`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
var D = a(`group/field flex w-full gap-3 data-[invalid=true]:text-destructive`, {
  variants: {
    orientation: {
      vertical: [`flex-col [&>*]:w-full [&>.sr-only]:w-auto`],
      horizontal: [
        `flex-row items-center`,
        `[&>[data-slot=field-label]]:flex-auto`,
        `has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px`,
      ],
      responsive: [
        `flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto`,
        `@md/field-group:[&>[data-slot=field-label]]:flex-auto`,
        `@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px`,
      ],
    },
  },
  defaultVariants: { orientation: `vertical` },
});
function O(e) {
  let t = (0, x.c)(11),
    n,
    r,
    a;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (a = t[3]))
    : (({ className: n, orientation: a, ...r } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = a));
  let o = a === void 0 ? `vertical` : a,
    s;
  t[4] !== n || t[5] !== o
    ? ((s = i(D({ orientation: o }), n)), (t[4] = n), (t[5] = o), (t[6] = s))
    : (s = t[6]);
  let c;
  return (
    t[7] !== o || t[8] !== r || t[9] !== s
      ? ((c = (0, l.jsx)(`div`, {
          role: `group`,
          "data-slot": `field`,
          "data-orientation": o,
          className: s,
          ...r,
        })),
        (t[7] = o),
        (t[8] = r),
        (t[9] = s),
        (t[10] = c))
      : (c = t[10]),
    c
  );
}
function k(e) {
  let t = (0, x.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(`group/field-content flex flex-1 flex-col gap-1.5 leading-snug`, n)),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== r || t[6] !== a
      ? ((o = (0, l.jsx)(`div`, { "data-slot": `field-content`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function A(e) {
  let t = (0, x.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(
        `group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50`,
        `has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4`,
        `has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 dark:has-data-[state=checked]:bg-primary/10`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== r || t[6] !== a
      ? ((o = (0, l.jsx)(S, { "data-slot": `field-label`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function j(e) {
  let t = (0, x.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(
        `text-sm leading-normal font-normal text-muted-foreground group-has-[[data-orientation=horizontal]]/field:text-balance`,
        `last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5`,
        `[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== r || t[6] !== a
      ? ((o = (0, l.jsx)(`p`, { "data-slot": `field-description`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function M(e) {
  let t = (0, x.c)(15),
    n,
    r,
    a,
    o;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (a = t[3]), (o = t[4]))
    : (({ className: r, children: n, errors: a, ...o } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = a),
      (t[4] = o));
  let s;
  bb0: {
    if (n) {
      s = n;
      break bb0;
    }
    if (!a?.length) {
      s = null;
      break bb0;
    }
    let e;
    t[5] === a ? (e = t[6]) : ((e = [...new Map(a.map(P)).values()]), (t[5] = a), (t[6] = e));
    let r = e;
    if (r?.length == 1) {
      s = r[0]?.message;
      break bb0;
    }
    let i;
    (t[7] === r
      ? (i = t[8])
      : ((i = (0, l.jsx)(`ul`, {
          className: `ml-4 flex list-disc flex-col gap-1`,
          children: r.map(N),
        })),
        (t[7] = r),
        (t[8] = i)),
      (s = i));
  }
  let c = s;
  if (!c) return null;
  let u;
  t[9] === r
    ? (u = t[10])
    : ((u = i(`text-sm font-normal text-destructive`, r)), (t[9] = r), (t[10] = u));
  let d;
  return (
    t[11] !== c || t[12] !== o || t[13] !== u
      ? ((d = (0, l.jsx)(`div`, {
          role: `alert`,
          "data-slot": `field-error`,
          className: u,
          ...o,
          children: c,
        })),
        (t[11] = c),
        (t[12] = o),
        (t[13] = u),
        (t[14] = d))
      : (d = t[14]),
    d
  );
}
function N(e, t) {
  return e?.message && (0, l.jsx)(`li`, { children: e.message }, t);
}
function P(e) {
  return [e?.message, e];
}
export { E as a, w as c, b as d, M as i, C as l, k as n, A as o, j as r, T as s, O as t, S as u };
