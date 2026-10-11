import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { sessionQuery, signOut } from "../../session/queries";
import { currentShop, selectShop, type Shop } from "../../shops/shop-store";

/** Switches shop. A shop without a session for this device goes to login with its code filled in. */
export function usePickShop() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (shop: Shop) => {
      selectShop(shop.id);
      queryClient.removeQueries({ predicate: isTenantQuery });
      return queryClient.fetchQuery(sessionQuery());
    },
    onSuccess: (session, shop) =>
      navigate(session ? { to: "/products" } : { to: "/login", search: { shop: shop.slug } }),
    onError: (error) => toast.error(error.message),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await navigate({ to: "/login", search: { shop: currentShop()?.slug || undefined } });
      queryClient.removeQueries({ predicate: isTenantQuery });
    },
    onError: (error) => toast.error(error.message),
  });
}

// Everything fetched for a shop and user; the public org lookup is not tenant data and stays.
function isTenantQuery({ queryKey }: { queryKey: readonly unknown[] }) {
  return queryKey[0] !== "org";
}
