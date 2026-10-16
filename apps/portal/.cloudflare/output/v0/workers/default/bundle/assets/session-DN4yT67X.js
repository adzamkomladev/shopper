import { F as nullable, L as object, Q as string, h as boolean } from "./react-dom-BCYT53bd.js";
import { n as redirect } from "./redirect-gaJ0mgfA.js";
import { i as currentShop, n as ApiError, r as apiFetch } from "./createLucideIcon-DmKyVZgg.js";
import { t as queryOptions } from "./queryOptions-eKLVKX7x.js";
import { a as orgSummary } from "./schemas-B4d_8FW9.js";
//#region ../../packages/backoffice/src/schemas/session.ts
var session = nullable(
  object({
    user: object({
      id: string(),
      name: string(),
      email: string(),
    }),
  }),
);
var done = object({ success: boolean() });
//#endregion
//#region ../../packages/backoffice/src/queries/session/session.ts
var SESSION_MS = 6e4;
/** Everything fetched for a shop and user; the public org lookup is not tenant data and stays. */
function isTenantQuery({ queryKey }) {
  return queryKey[0] !== "org";
}
/** The signed-in user for a shop (default: the current one), or null. Keyed and fetched per shop, so a shop switch can never read another shop's answer. */
function sessionQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["session", shop?.id ?? "box"],
    queryFn: () => apiFetch("/auth/get-session", session, { shopId: shop?.id ?? null }),
    staleTime: SESSION_MS,
  });
}
/** The box's fixed org. The cloud answers 404, so there the shop code is asked for. */
var currentOrgQuery = queryOptions({
  queryKey: ["org", "current"],
  queryFn: async () => {
    try {
      return await apiFetch("/orgs/current", orgSummary);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  staleTime: Infinity,
});
async function lookupShop(code) {
  try {
    return await apiFetch(`/orgs/${encodeURIComponent(code.trim())}`, orgSummary);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      throw new ApiError(404, "No shop has that code", "shopCode");
    throw error;
  }
}
function signOut() {
  return apiFetch("/auth/sign-out", done, {
    method: "POST",
    body: {},
  });
}
/** Route guard: lets a signed-in user through, otherwise sends them to login with their shop code. */
async function requireSession(queryClient) {
  const shop = currentShop();
  if (
    !(
      (shop ?? (await queryClient.ensureQueryData(currentOrgQuery))) &&
      (await queryClient.ensureQueryData(sessionQuery()))
    )
  )
    throw redirect({
      to: "/login",
      search: { shop: shop?.slug || void 0 },
    });
}
//#endregion
export {
  sessionQuery as a,
  requireSession as i,
  isTenantQuery as n,
  signOut as o,
  lookupShop as r,
  currentOrgQuery as t,
};
