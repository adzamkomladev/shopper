import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { stockProducts } from "../../schemas/stock/queue";
import { currentShop } from "../../stores/shops";

/** Products on this register matching a name, SKU or barcode. Nothing is asked for an empty search. */
export function productSearchQuery(search: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["stock", shop?.id ?? "box", "products", search],
    queryFn: () =>
      apiFetch(`/register/products?q=${encodeURIComponent(search)}`, stockProducts, {
        shopId: shop?.id ?? null,
      }),
    enabled: search.trim().length > 0,
    placeholderData: keepPreviousData,
  });
}
