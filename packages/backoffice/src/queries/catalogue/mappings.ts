import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import {
  deletedMapping,
  mappingList,
  mappingView,
  toMappingBody,
  type MappingValues,
  type MappingView,
} from "../../schemas/catalogue/mappings";
import { currentShop } from "../../stores/shops";

const PATH = "/catalogue/barcodes/mappings";
const KEY = "barcode-mappings";

export function mappingsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: [KEY, shop?.id ?? "box"],
    queryFn: () => apiFetch(PATH, mappingList, { shopId: shop?.id ?? null }),
  });
}

/** Creates a layout, or updates `editing` when given. The list is refetched so it shows the change. */
export function useSaveMapping(editing: Pick<MappingView, "id"> | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: MappingValues) =>
      apiFetch(editing ? `${PATH}/${editing.id}` : PATH, mappingView, {
        method: editing ? "PATCH" : "POST",
        body: toMappingBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Layout saved" : "Layout added");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeleteMapping(onDeleted: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mapping: Pick<MappingView, "id">) =>
      apiFetch(`${PATH}/${mapping.id}`, deletedMapping, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Layout deleted");
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: [KEY] });
    },
    // Gone already (someone else deleted it): the list is stale, so refresh it either way.
    onError: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
