import { $ as e, I as t, R as n, a as r, b as i, i as a, o } from "./createLucideIcon-BBeoGZx-.js";
import { t as s } from "./queryOptions-BmBcu1YJ.js";
import { f as c } from "./schemas-CMFvL3XH.js";
function l(e) {
  e.statusCode = e.statusCode || e.code || 307;
  let t = new Headers(e.headers);
  e.href && t.get(`Location`) === null && t.set(`Location`, e.href);
  let n = new Response(null, { status: e.statusCode, headers: t });
  if (((n.options = e), e.throw)) throw n;
  return n;
}
function u(e) {
  return e instanceof Response && !!e.options;
}
function d(e) {
  if (typeof e == `object` && e && e.isSerializedRedirect) return l(e);
}
var f = t(n({ user: n({ id: e(), name: e(), email: e() }) })),
  p = n({ success: i() }),
  m = 6e4;
function h({ queryKey: e }) {
  return e[0] !== `org`;
}
function g(e = o()) {
  return s({
    queryKey: [`session`, e?.id ?? `box`],
    queryFn: () => r(`/auth/get-session`, f, { shopId: e?.id ?? null }),
    staleTime: m,
  });
}
var _ = s({
  queryKey: [`org`, `current`],
  queryFn: async () => {
    try {
      return await r(`/orgs/current`, c);
    } catch (e) {
      if (e instanceof a && e.status === 404) return null;
      throw e;
    }
  },
  staleTime: 1 / 0,
});
async function v(e) {
  try {
    return await r(`/orgs/${encodeURIComponent(e.trim())}`, c);
  } catch (e) {
    throw e instanceof a && e.status === 404 ? new a(404, `No shop has that code`, `shopCode`) : e;
  }
}
function y() {
  return r(`/auth/sign-out`, p, { method: `POST`, body: {} });
}
async function b(e) {
  let t = o();
  if (!((t ?? (await e.ensureQueryData(_))) && (await e.ensureQueryData(g()))))
    throw l({ to: `/login`, search: { shop: t?.slug || void 0 } });
}
export { g as a, d as c, b as i, l, h as n, y as o, v as r, u as s, _ as t };
