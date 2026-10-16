import { w as sessionPermissionsResponse } from "./schemas-DUCUNo6u.js";
import { i as currentShop, r as apiFetch } from "./createLucideIcon-DmKyVZgg.js";
import { t as queryOptions } from "./queryOptions-eKLVKX7x.js";
import { t as useQuery } from "./useQuery-D4rdH9-y.js";
//#region ../../packages/backoffice/src/queries/session/permissions.ts
var PERMISSIONS_MS = 6e4;
/** The permission codes the signed-in member holds in this shop, which decide what the shell shows. */
function permissionsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["session", shop?.id ?? "box", "permissions"],
    queryFn: () =>
      apiFetch("/session/permissions", sessionPermissionsResponse, { shopId: shop?.id ?? null }),
    staleTime: PERMISSIONS_MS,
  });
}
/** The held codes, or undefined while they load or when they can't be read (then nothing is offered). */
function usePermissions() {
  return useQuery(permissionsQuery()).data;
}
//#endregion
export { usePermissions as n, permissionsQuery as t };
