import { Bt as e, Ht as t, _ as n, g as r } from "./createLucideIcon-BBeoGZx-.js";
var i = n();
t();
var a = e();
function o(e) {
  let t = (0, i.c)(12),
    n,
    o,
    s,
    c;
  t[0] === e
    ? ((n = t[1]), (o = t[2]), (s = t[3]), (c = t[4]))
    : (({ className: n, type: c, touch: s, ...o } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = o),
      (t[3] = s),
      (t[4] = c));
  let l = s && `h-11`,
    u;
  t[5] !== n || t[6] !== l
    ? ((u = r(
        `h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30`,
        `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`,
        `aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40`,
        l,
        n,
      )),
      (t[5] = n),
      (t[6] = l),
      (t[7] = u))
    : (u = t[7]);
  let d;
  return (
    t[8] !== o || t[9] !== u || t[10] !== c
      ? ((d = (0, a.jsx)(`input`, { type: c, "data-slot": `input`, className: u, ...o })),
        (t[8] = o),
        (t[9] = u),
        (t[10] = c),
        (t[11] = d))
      : (d = t[11]),
    d
  );
}
export { o as t };
