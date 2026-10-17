import {
  $ as e,
  B as t,
  E as n,
  M as r,
  R as i,
  S as a,
  W as o,
} from "./createLucideIcon-BBeoGZx-.js";
import { b as s, g as c, h as l, m as u } from "./schemas-DTb5O009.js";
function d(t, r) {
  return o(
    e(),
    a((e) => n(t, e), r),
  );
}
var f = d(c, `Enter your name`),
  p = d(u, `Enter a valid email address`),
  m = d(s, `Use lowercase letters, numbers and hyphens, like ama-mart`),
  h = d(l, `Use at least 12 characters`),
  g = i({ name: f, email: p, shopName: d(c, `Enter your shop's name`), shopCode: m }),
  _ = i({ shopCode: m, password: h }),
  v = i({ name: f, password: h }),
  y = i({ name: t(e()), password: o(e(), r(1, `Enter your password`)) }),
  b = `Lowercase letters, numbers and hyphens. Staff type it to log in.`;
function x(e) {
  return e
    .toLowerCase()
    .normalize(`NFKD`)
    .replace(/[^a-z0-9]+/g, `-`)
    .replace(/^-+|-+$/g, ``)
    .slice(0, 80);
}
export { g as a, v as i, _ as n, x as o, y as r, b as t };
