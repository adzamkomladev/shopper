import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import * as v from "valibot";
import { orgSummary } from "@shopper/core/schemas";
import { ApiError, apiFetch } from "../api/client";
import { currentShop } from "../shops/shop-store";

const SESSION_MS = 60_000;
const session = v.nullable(
  v.object({ user: v.object({ id: v.string(), name: v.string(), email: v.string() }) }),
);
const done = v.object({ success: v.boolean() });

/** The signed-in user for a shop (default: the current one), or null. Keyed and fetched per shop, so a shop switch can never read another shop's answer. */
export function sessionQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["session", shop?.id ?? "box"],
    queryFn: () => apiFetch("/auth/get-session", session, { shopId: shop?.id ?? null }),
    staleTime: SESSION_MS,
  });
}

/** The box's fixed org. The cloud answers 404, so there the shop code is asked for. */
export const currentOrgQuery = queryOptions({
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

export async function lookupShop(code: string) {
  try {
    return await apiFetch(`/orgs/${encodeURIComponent(code.trim())}`, orgSummary);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      throw new ApiError(404, "No shop has that code", "shopCode");
    throw error;
  }
}

export function signOut() {
  return apiFetch("/auth/sign-out", done, { method: "POST", body: {} });
}

/** Route guard: lets a signed-in user through, otherwise sends them to login with their shop code. */
export async function requireSession(queryClient: QueryClient) {
  const shop = currentShop();
  const org = shop ?? (await queryClient.ensureQueryData(currentOrgQuery));
  const user = org && (await queryClient.ensureQueryData(sessionQuery()));
  if (!user) throw redirect({ to: "/login", search: { shop: shop?.slug || undefined } });
}
