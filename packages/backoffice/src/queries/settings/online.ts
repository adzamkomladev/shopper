import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoryView } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { onlineSettingsView } from "../../schemas/settings/online";
import { currentShop } from "../../stores/shops";
import { categoriesQuery } from "../catalogue/list";

/** The online store's settings, read from `/settings/online`. */
export function onlineSettingsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["settings", shop?.id ?? "box", "online"],
    queryFn: () => apiFetch("/settings/online", onlineSettingsView, { shopId: shop?.id ?? null }),
    // While the first publish is on its way the page asks again, so it shows how it went without a reload.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.onlineOrders && !data.publishedAt && !data.error ? 5000 : false;
    },
  });
}

/**
 * Turns Online Orders on or off on the box, or saves the units it keeps back from the online store; the page keeps
 * what the API answers with.
 */
export function useSaveOnlineOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { onlineOrders: boolean; buffer?: number }) =>
      apiFetch("/settings/online", onlineSettingsView, { method: "PUT", body }),
    onSuccess: (data, body) => {
      queryClient.setQueryData(onlineSettingsQuery().queryKey, data);
      toast.success(
        body.buffer !== undefined
          ? `The online store now keeps back ${data.buffer} of every product`
          : data.onlineOrders
            ? "Online Orders is on"
            : "Online Orders is off",
      );
    },
    onError: (error) => toast.error(error.message),
  });
}

/** Shows or hides one category (and, for a department, everything under it) in the online store. */
export function useShowCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; onlineVisible: boolean }) =>
      apiFetch(`/categories/${input.id}`, categoryView, {
        method: "PATCH",
        body: { onlineVisible: input.onlineVisible },
      }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery().queryKey });
      toast.success(
        category.onlineVisible ? `${category.name} is online` : `${category.name} is hidden online`,
      );
    },
    onError: (error) => toast.error(error.message),
  });
}
