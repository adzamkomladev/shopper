import { Bt as e, Ht as t, _ as n, d as r, g as i, h as a } from "./createLucideIcon-BBeoGZx-.js";
var o = n();
t();
var s = e(),
  c = a(
    `inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3`,
    {
      variants: {
        variant: {
          default: `bg-primary text-primary-foreground [a&]:hover:bg-primary/90`,
          secondary: `bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90`,
          destructive: `bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90`,
          outline: `border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground`,
          ghost: `[a&]:hover:bg-accent [a&]:hover:text-accent-foreground`,
          link: `text-primary underline-offset-4 [a&]:hover:underline`,
        },
      },
      defaultVariants: { variant: `default` },
    },
  );
function l(e) {
  let t = (0, o.c)(13),
    n,
    a,
    l,
    u;
  t[0] === e
    ? ((n = t[1]), (a = t[2]), (l = t[3]), (u = t[4]))
    : (({ className: n, variant: l, asChild: u, ...a } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = a),
      (t[3] = l),
      (t[4] = u));
  let d = l === void 0 ? `default` : l,
    f = u !== void 0 && u ? r : `span`,
    p;
  t[5] !== n || t[6] !== d
    ? ((p = i(c({ variant: d }), n)), (t[5] = n), (t[6] = d), (t[7] = p))
    : (p = t[7]);
  let m;
  return (
    t[8] !== f || t[9] !== a || t[10] !== p || t[11] !== d
      ? ((m = (0, s.jsx)(f, { "data-slot": `badge`, "data-variant": d, className: p, ...a })),
        (t[8] = f),
        (t[9] = a),
        (t[10] = p),
        (t[11] = d),
        (t[12] = m))
      : (m = t[12]),
    m
  );
}
export { l as t };
