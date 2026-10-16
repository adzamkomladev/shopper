import { Bt as e, _ as t, o as n, u as r } from "./createLucideIcon-BBeoGZx-.js";
import { a as i } from "./alert-BTZapdK4.js";
import { t as a } from "./circle-check-qjEDsf6Y.js";
import { Ft as o } from "./index-DZbZvBMN.js";
var s = t(),
  c = e();
function l(e) {
  let t = (0, s.c)(6),
    { onContinue: l } = e,
    u;
  t[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((u = n()), (t[0] = u)) : (u = t[0]);
  let d = u,
    f;
  t[1] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((f = (0, c.jsx)(a, {
        "aria-hidden": !0,
        className: `size-27 fill-success text-success-foreground [&>circle]:stroke-success`,
      })),
      (t[1] = f))
    : (f = t[1]);
  let p;
  t[2] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((p = (0, c.jsx)(`h1`, {
        className: `text-4xl font-semibold tracking-tight`,
        children: `You're signed in`,
      })),
      (t[2] = p))
    : (p = t[2]);
  let m;
  t[3] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((m = (0, c.jsxs)(`div`, {
        className: `flex flex-col gap-5`,
        children: [
          p,
          (0, c.jsx)(`p`, {
            className: `text-lg font-medium`,
            children: d ? `You're signed in to ${d.name}.` : `You can now use the back office.`,
          }),
        ],
      })),
      (t[3] = m))
    : (m = t[3]);
  let h;
  return (
    t[4] === l
      ? (h = t[5])
      : ((h = (0, c.jsxs)(o, {
          className: `flex flex-col items-center gap-9 px-6 text-center sm:px-22`,
          children: [
            f,
            m,
            (0, c.jsx)(r, {
              size: `lg`,
              className: `w-full rounded-full`,
              onClick: l,
              ref: i,
              children: `Continue to products`,
            }),
          ],
        })),
        (t[4] = l),
        (t[5] = h)),
    h
  );
}
export { l as t };
