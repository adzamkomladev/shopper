import { queryOptions } from "@tanstack/react-query";
import { productDetail } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { currentShop } from "../../shops/shop-store";

export function productQuery(productId: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["product", shop?.id ?? "box", productId],
    queryFn: () => apiFetch(`/products/${productId}`, productDetail, { shopId: shop?.id ?? null }),
  });
}
