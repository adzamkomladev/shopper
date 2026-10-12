import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { productPage } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
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

const PALETTE_RESULTS = 8;

/** Products matching what the palette's search box says (name, SKU or barcode). */
export function usePaletteProducts(term: string, online: boolean) {
  const shop = currentShop();
  const search = term.trim();
  return useQuery({
    queryKey: ["products", "palette", shop?.id ?? "box", search],
    queryFn: () =>
      apiFetch(
        `/products?${new URLSearchParams({ q: search, limit: String(PALETTE_RESULTS) })}`,
        productPage,
        {
          shopId: shop?.id ?? null,
        },
      ),
    enabled: online && search.length > 0,
    placeholderData: keepPreviousData,
  });
}
