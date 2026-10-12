import { queryOptions, useQuery } from "@tanstack/react-query";
import { sessionPermissionsResponse } from "@shopper/auth/schemas";
import { apiFetch } from "../api/client";
import { currentShop } from "../shops/store";

const PERMISSIONS_MS = 60_000;

/** The permission codes the signed-in member holds in this shop, which decide what the shell shows. */
export function permissionsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["session", shop?.id ?? "box", "permissions"],
    queryFn: () =>
      apiFetch("/session/permissions", sessionPermissionsResponse, { shopId: shop?.id ?? null }),
    staleTime: PERMISSIONS_MS,
  });
}

/** The held codes, or undefined while they load or when they can't be read (then nothing is offered). */
export function usePermissions() {
  return useQuery(permissionsQuery()).data;
}
