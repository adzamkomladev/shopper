import { storeList, deletedStore } from "../schemas/stores";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, apiFetch } from "../api/client";
import { currentShop } from "../stores/shops";
import { storeView, toStoreBody, type StoreValues, type StoreView } from "../schemas/management";

export function storesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["stores", shop?.id ?? "box"],
    queryFn: () => apiFetch("/stores", storeList, { shopId: shop?.id ?? null }),
  });
}

/** Creates a store, or updates `editing` when given. The list is refetched so it shows the change. */
export function useSaveStore(editing: StoreView | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: StoreValues) =>
      apiFetch(editing ? `/stores/${editing.id}` : "/stores", storeView, {
        method: editing ? "PATCH" : "POST",
        body: toStoreBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Store saved" : "Store added");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}

export function useDeleteStore(onDeleted: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (store: StoreView) =>
      apiFetch(`/stores/${store.id}`, deletedStore, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Store deleted");
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}

/** What to tell the owner when a delete is refused because other records still point at it. */
export function deleteMessage(error: Error, name: string) {
  return error instanceof ApiError && error.status === 409
    ? `${name} is still used by other records, so it can't be deleted.`
    : error.message;
}
