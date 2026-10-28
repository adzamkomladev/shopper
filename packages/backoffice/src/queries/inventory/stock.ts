import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { stockBranchList, stockList, stockProductView } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { reorderSet, toReorderBody, type ReorderValues } from "../../schemas/inventory/reorder";
import { currentShop } from "../../stores/shops";

export type { StockItem, StockMovement, StockProduct, StockSearch } from "./types";

export const STOCK_PAGE_SIZE = 100;
type Filters = { branchId: string; q?: string; low?: true; negative?: true };

/** The branches stock can be read at, sorted by name. */
export function stockBranchesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["stock", shop?.id ?? "box", "branches"],
    queryFn: () => apiFetch("/stock/branches", stockBranchList, { shopId: shop?.id ?? null }),
  });
}

/** One branch's products a page at a time. Keyed by shop, branch and filters, so none share a list. */
export function stockListQuery({ branchId, q, low, negative }: Filters, shop = currentShop()) {
  return infiniteQueryOptions({
    queryKey: [
      "stock",
      shop?.id ?? "box",
      "list",
      branchId,
      q ?? "",
      low ? "low" : "",
      negative ? "negative" : "",
    ],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ branchId, limit: String(STOCK_PAGE_SIZE) });
      if (q) params.set("q", q);
      if (low) params.set("low", "1");
      if (negative) params.set("negative", "1");
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch(`/stock?${params}`, stockList, { shopId: shop?.id ?? null });
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** A product's stock at a branch with its movements, newest first. */
export function stockProductQuery(productId: string, branchId: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["stock", shop?.id ?? "box", "product", branchId, productId],
    queryFn: () =>
      apiFetch(
        `/stock/products/${productId}?${new URLSearchParams({ branchId })}`,
        stockProductView,
        {
          shopId: shop?.id ?? null,
        },
      ),
  });
}

/** Sets the level, or removes it when the field is empty. Every stock list and page is refetched: Low can change on both. */
export function useSaveReorder(branchId: string, productId: string, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ReorderValues) =>
      apiFetch("/stock/reorder", reorderSet, {
        method: "PUT",
        body: toReorderBody(branchId, productId, values),
      }),
    onSuccess: async ({ levelThousandths }) => {
      toast.success(levelThousandths === null ? "Reorder level removed" : "Reorder level saved");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
  });
}
