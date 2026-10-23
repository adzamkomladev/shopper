import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as v from "valibot";
import { apiFetch } from "../../api/client";
import { creditSettingsView } from "../../schemas/settings/credit";
import { kycSettingsView } from "../../schemas/settings/kyc";
import { loyaltySettingsView } from "../../schemas/settings/loyalty";
import { currentShop } from "../../stores/shops";

const schemas = {
  loyalty: loyaltySettingsView,
  credit: creditSettingsView,
  kyc: kycSettingsView,
} as const;
type Name = keyof typeof schemas;

const key = (name: Name, shop: ReturnType<typeof currentShop>) =>
  ["settings", shop?.id ?? "box", name] as const;

/** One of the org's settings, read from `/settings/<name>`. */
export function settingsQuery<N extends Name>(name: N, shop = currentShop()) {
  return queryOptions({
    queryKey: key(name, shop),
    queryFn: () => apiFetch(`/settings/${name}`, schemas[name], { shopId: shop?.id ?? null }),
  });
}

/** Replaces the setting; the page keeps what the API answers with, which is what was stored. */
export function useSaveSettings<N extends Name>(name: N, saved: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: v.InferOutput<(typeof schemas)[N]>) =>
      apiFetch(`/settings/${name}`, schemas[name], { method: "PUT", body }),
    onSuccess: (data) => {
      queryClient.setQueryData(key(name, currentShop()), data);
      toast.success(saved);
    },
  });
}
