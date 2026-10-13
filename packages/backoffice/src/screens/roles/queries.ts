import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as v from "valibot";
import { permissionListResponse, roleListItem, roleListResponse } from "@shopper/auth/schemas";
import { apiFetch } from "../../api/client";
import { permissionsQuery } from "../../session/permissions";
import { currentShop } from "../../shops/store";

export type RoleView = v.InferOutput<typeof roleListItem>;
export type RoleValues = { name: string; permissionCodes: string[] };

export function rolesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["roles", shop?.id ?? "box"],
    queryFn: () => apiFetch("/roles", roleListResponse, { shopId: shop?.id ?? null }),
  });
}

/** Every permission this shop knows, including which ones apply on a till. */
export function permissionsListQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["permissions", shop?.id ?? "box"],
    queryFn: () => apiFetch("/permissions", permissionListResponse, { shopId: shop?.id ?? null }),
  });
}

/** What the owner role is called on screen: the stored name is internal. */
export const roleLabel = (role: Pick<RoleView, "name" | "protectedOwner">) =>
  role.protectedOwner ? "Owner" : role.name;

/** Creates a role, or saves `editing`. A role change can change what this member may do, so permissions are refetched too. */
export function useSaveRole(editing: RoleView | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: RoleValues) =>
      apiFetch(editing ? `/roles/${editing.id}` : "/roles", roleListItem, {
        method: editing ? "PATCH" : "POST",
        body: values,
      }),
    onSuccess: async () => {
      toast.success(editing ? "Role saved" : "Role created");
      onSaved();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
    },
  });
}

/** What the roles screen needs before it can draw: its own list, what a till allows and what this member holds. */
export const rolesScreenQueries = () => [rolesQuery(), permissionsListQuery(), permissionsQuery()];
