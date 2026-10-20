import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supplierView } from "@shopper/core/schemas";
import { apiFetch } from "../api/client";
import {
  supplierList,
  toSupplierBody,
  type SupplierValues,
  type SupplierView,
} from "../schemas/suppliers";
import { currentShop } from "../stores/shops";

export type { SupplierView } from "../schemas/suppliers";

/** Every supplier, sorted by name. */
export function suppliersQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["suppliers", shop?.id ?? "box"],
    queryFn: () => apiFetch("/suppliers", supplierList, { shopId: shop?.id ?? null }),
  });
}

/** Creates a supplier, or updates `editing` when given. The list is refetched so it shows the change. */
export function useSaveSupplier(editing: SupplierView | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SupplierValues) =>
      apiFetch(editing ? `/suppliers/${editing.id}` : "/suppliers", supplierView, {
        method: editing ? "PATCH" : "POST",
        body: toSupplierBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Supplier saved" : "Supplier added");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
