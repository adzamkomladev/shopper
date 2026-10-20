import { queryOptions } from "@tanstack/react-query";
import { stockValuationView } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { currentShop } from "../../stores/shops";

/** What one branch's stock is worth at the last unit cost, line by line, with the total. */
export function valuationQuery(branchId: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["stock", shop?.id ?? "box", "valuation", branchId],
    queryFn: () =>
      apiFetch(`/stock/valuation?${new URLSearchParams({ branchId })}`, stockValuationView, {
        shopId: shop?.id ?? null,
      }),
  });
}
