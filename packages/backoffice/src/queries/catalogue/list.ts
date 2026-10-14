import { categoryList } from "../../schemas/catalogue/list";
import type { CategoryView, ProductSearch } from "./types";
export type { CategoryView, ProductSummary, ProductSearch } from "./types";
import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { categoryView, productDetail, productPage } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { currentShop } from "../../stores/shops";
import { toProductBody, type NewProductValues } from "../../schemas/catalogue";

export const PAGE_SIZE = 100;

/** Newest first, a page at a time. Keyed by shop and search, so shops never share a list. */
export function productsQuery({ q, categoryId }: ProductSearch, shop = currentShop()) {
  return infiniteQueryOptions({
    queryKey: ["products", shop?.id ?? "box", q ?? "", categoryId ?? ""],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (categoryId) params.set("categoryId", categoryId);
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch(`/products?${params}`, productPage, { shopId: shop?.id ?? null });
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function categoriesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["categories", shop?.id ?? "box"],
    queryFn: () => apiFetch("/categories", categoryList, { shopId: shop?.id ?? null }),
  });
}

/** Adds the product; the list is refetched so the new row shows first. */
export function useCreateProduct(onCreated: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: NewProductValues) =>
      apiFetch("/products", productDetail, { method: "POST", body: toProductBody(values) }),
    onSuccess: async () => {
      toast.success("Product added");
      onCreated();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/** Creates a top-level category from the product form and refreshes the category list. */
export function useCreateCategory(onCreated: (category: CategoryView) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch("/categories", categoryView, { method: "POST", body: { name } }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery().queryKey });
      onCreated(category);
    },
    onError: (error) => toast.error(error.message),
  });
}
