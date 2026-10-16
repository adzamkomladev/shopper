import {
  Bt as e,
  Ht as t,
  Vt as n,
  Wt as r,
  _ as i,
  f as a,
  g as o,
  h as s,
} from "./createLucideIcon-BBeoGZx-.js";
var c = r(t(), 1),
  l = r(n(), 1),
  u = e(),
  d = Object.defineProperty,
  f = (e, t) => d(e, `name`, { value: t, configurable: !0 }),
  p = [
    `a`,
    `button`,
    `div`,
    `form`,
    `h2`,
    `h3`,
    `img`,
    `input`,
    `label`,
    `li`,
    `nav`,
    `ol`,
    `p`,
    `select`,
    `span`,
    `svg`,
    `ul`,
  ].reduce((e, t) => {
    let n = a(`Primitive.${t}`),
      r = c.forwardRef((e, r) => {
        let { asChild: i, ...a } = e,
          o = i ? n : t;
        return (
          typeof window < `u` && (window[Symbol.for(`radix-ui`)] = !0),
          (0, u.jsx)(o, { ...a, ref: r })
        );
      });
    return ((r.displayName = `Primitive.${t}`), { ...e, [t]: r });
  }, {});
function m(e, t) {
  e && l.flushSync(() => e.dispatchEvent(t));
}
f(m, `dispatchDiscreteCustomEvent`);
function h(e) {
  e?.focus();
}
function g(e) {
  e && document.activeElement === document.body && e.focus();
}
function _({ formApi: e }) {
  let t = Object.entries(e.state.fieldMeta).find(([, e]) => e?.errors.length);
  t && document.getElementById(t[0])?.focus();
}
var v = i(),
  y = s(
    `relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current`,
    {
      variants: {
        variant: {
          default: `bg-card text-card-foreground`,
          destructive: `bg-card text-destructive *:data-[slot=alert-description]:text-destructive [&>svg]:text-current`,
        },
      },
      defaultVariants: { variant: `default` },
    },
  );
function b(e) {
  let t = (0, v.c)(10),
    n,
    r,
    i;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]))
    : (({ className: n, variant: i, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = i));
  let a;
  t[4] !== n || t[5] !== i
    ? ((a = o(y({ variant: i }), n)), (t[4] = n), (t[5] = i), (t[6] = a))
    : (a = t[6]);
  let s;
  return (
    t[7] !== r || t[8] !== a
      ? ((s = (0, u.jsx)(`div`, { "data-slot": `alert`, role: `alert`, className: a, ...r })),
        (t[7] = r),
        (t[8] = a),
        (t[9] = s))
      : (s = t[9]),
    s
  );
}
function x(e) {
  let t = (0, v.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = o(
        `col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let a;
  return (
    t[5] !== r || t[6] !== i
      ? ((a = (0, u.jsx)(`div`, { "data-slot": `alert-description`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = a))
      : (a = t[7]),
    a
  );
}
export { h as a, g as i, x as n, p as o, _ as r, m as s, b as t };
