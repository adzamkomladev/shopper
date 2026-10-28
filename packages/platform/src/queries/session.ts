import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { currentShop, isTenantQuery, sessionQuery, signOut } from "@shopper/backoffice/kit";
import { platformOrgQuery } from "./platform";

/** Route guard: only a session in the platform org gets past; anything else signs in again. */
export async function requireStaff(queryClient: QueryClient) {
  const platform = await queryClient.ensureQueryData(platformOrgQuery);
  const shop = currentShop();
  if (shop?.id !== platform.id) throw redirect({ to: "/login" });
  if (!(await queryClient.ensureQueryData(sessionQuery(shop)))) throw redirect({ to: "/login" });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await navigate({ to: "/login" });
      queryClient.removeQueries({ predicate: isTenantQuery });
    },
    onError: (error) => toast.error(error.message),
  });
}
