import {
  $ as e,
  A as t,
  M as n,
  R as r,
  U as i,
  V as a,
  W as o,
  Z as s,
  i as c,
  nt as l,
} from "./createLucideIcon-BBeoGZx-.js";
import { g as u } from "./schemas-CMFvL3XH.js";
(s(n, `Required`),
  s(t, (e) => `Use ${e.requirement} characters or fewer`),
  s(i, `Choose an option`));
var { name: d, sku: f, baseUnit: p, taxClass: m, categoryId: h } = u.entries,
  g = r({ name: d, sku: f, baseUnit: p, taxClass: m, categoryId: h, barcode: o(e(), l(), t(64)) }),
  _ = [`name`, `sku`, `baseUnit`, `taxClass`, `categoryId`, `barcode`],
  v = { name: ``, sku: ``, baseUnit: `each`, taxClass: `standard`, categoryId: null, barcode: `` };
function y({ barcode: e, ...t }) {
  return a(u, { ...t, barcodes: e ? [{ code: e }] : [] });
}
function b(e) {
  return e instanceof c && e.status === 409 ? `Another product already uses this` : e.message;
}
function x(e) {
  if (!(e instanceof c) || !e.field) return;
  let t = e.field.startsWith(`barcodes`) ? `barcode` : e.field;
  return _.find((e) => e === t);
}
export { y as a, g as i, x as n, b as r, v as t };
