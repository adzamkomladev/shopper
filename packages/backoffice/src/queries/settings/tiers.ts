import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { tierList, tierView, type TierValues, type TierView } from "../../schemas/settings/loyalty";
import { toTierBody } from "../../schemas/settings/loyalty";
import { currentShop } from "../../stores/shops";

/** The tiers in play, lowest threshold first. */
export function tiersQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["settings", shop?.id ?? "box", "tiers"],
    queryFn: () => apiFetch("/loyalty/tiers", tierList, { shopId: shop?.id ?? null }),
  });
}

function useRefreshTiers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tiersQuery().queryKey });
}

/** Adds a tier, or changes `editing`. */
export function useSaveTier(editing: TierView | undefined, onSaved: () => void) {
  const refresh = useRefreshTiers();
  return useMutation({
    mutationFn: (values: TierValues) =>
      apiFetch(editing ? `/loyalty/tiers/${editing.id}` : "/loyalty/tiers", tierView, {
        method: editing ? "PATCH" : "POST",
        body: toTierBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Tier saved" : "Tier added");
      onSaved();
      await refresh();
    },
  });
}

/** Takes a tier out of play; customers already in it keep what they earned. */
export function useArchiveTier(onArchived: () => void) {
  const refresh = useRefreshTiers();
  return useMutation({
    mutationFn: (tier: Pick<TierView, "id">) =>
      apiFetch(`/loyalty/tiers/${tier.id}/archive`, tierView, { method: "POST", body: {} }),
    onSuccess: async () => {
      toast.success("Tier archived");
      onArchived();
      await refresh();
    },
  });
}
