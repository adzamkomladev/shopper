import { Bt as e, Ht as t, Wt as n, _ as r, g as i, h as a } from "./createLucideIcon-BBeoGZx-.js";
import { t as o } from "./control-BkhcDTnQ.js";
var s = r(),
  c = n(t(), 1),
  l = e();
function u(e) {
  let t = (0, s.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(
        `group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30`,
        `h-9 min-w-0 has-[>textarea]:h-auto`,
        `has-[>[data-align=inline-start]]:[&>input]:pl-2`,
        `has-[>[data-align=inline-end]]:[&>input]:pr-2`,
        `has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3`,
        `has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3`,
        `has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:focus-ring`,
        `has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let o;
  return (
    t[5] !== r || t[6] !== a
      ? ((o = (0, l.jsx)(`div`, { "data-slot": `input-group`, role: `group`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
var d = a(
  `flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4`,
  {
    variants: {
      align: {
        "inline-start": `order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]`,
        "inline-end": `order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]`,
        "block-start": `order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3`,
        "block-end": `order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3`,
      },
    },
    defaultVariants: { align: `inline-start` },
  },
);
function f(e) {
  let t = (0, s.c)(11),
    n,
    r,
    a;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (a = t[3]))
    : (({ className: n, align: a, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = a));
  let o = a === void 0 ? `inline-start` : a,
    c;
  t[4] !== o || t[5] !== n
    ? ((c = i(d({ align: o }), n)), (t[4] = o), (t[5] = n), (t[6] = c))
    : (c = t[6]);
  let u;
  return (
    t[7] !== o || t[8] !== r || t[9] !== c
      ? ((u = (0, l.jsx)(`div`, {
          role: `group`,
          "data-slot": `input-group-addon`,
          "data-align": o,
          className: c,
          onClick: p,
          ...r,
        })),
        (t[7] = o),
        (t[8] = r),
        (t[9] = c),
        (t[10] = u))
      : (u = t[10]),
    u
  );
}
function p(e) {
  e.target.closest(`button`) || e.currentTarget.parentElement?.querySelector(`input`)?.focus();
}
a(`flex items-center gap-2 text-sm shadow-none`, {
  variants: {
    size: {
      xs: `h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5`,
      sm: `h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5`,
      "icon-xs": `size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0`,
      "icon-sm": `size-8 p-0 has-[>svg]:p-0`,
    },
  },
  defaultVariants: { size: `xs` },
});
function m(e) {
  let t = (0, s.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let a;
  t[3] === n
    ? (a = t[4])
    : ((a = i(
        `flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent`,
        n,
      )),
      (t[3] = n),
      (t[4] = a));
  let c;
  return (
    t[5] !== r || t[6] !== a
      ? ((c = (0, l.jsx)(o, { "data-slot": `input-group-control`, className: a, ...r })),
        (t[5] = r),
        (t[6] = a),
        (t[7] = c))
      : (c = t[7]),
    c
  );
}
function h(e, t) {
  let n = (0, c.useRef)(void 0),
    r = () => clearTimeout(n.current);
  return Object.assign(
    (...i) => {
      (r(), (n.current = setTimeout(() => e(...i), t)));
    },
    { cancel: r },
  );
}
export { m as i, u as n, f as r, h as t };
