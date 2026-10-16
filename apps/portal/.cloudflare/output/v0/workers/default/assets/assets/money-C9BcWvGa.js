import { Bt as e, _ as t, g as n } from "./createLucideIcon-BBeoGZx-.js";
import { t as r } from "./schemas-CMFvL3XH.js";
var i = t(),
  a = e();
function o(e) {
  let t = (0, i.c)(7),
    { amount: o, className: s } = e,
    c;
  t[0] === s ? (c = t[1]) : ((c = n(`block text-right tabular-nums`, s)), (t[0] = s), (t[1] = c));
  let l;
  t[2] === o ? (l = t[3]) : ((l = r(o)), (t[2] = o), (t[3] = l));
  let u;
  return (
    t[4] !== c || t[5] !== l
      ? ((u = (0, a.jsx)(`span`, { className: c, children: l })),
        (t[4] = c),
        (t[5] = l),
        (t[6] = u))
      : (u = t[6]),
    u
  );
}
export { o as t };
