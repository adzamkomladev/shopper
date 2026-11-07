import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { orderQueue, type OrderSearch } from "../../schemas/orders";
import { currentShop } from "../../stores/shops";

export const ordersKey = (shop = currentShop()) => ["orders", shop?.id ?? "box"] as const;

/** One stage of the store's online orders with the count of every stage; refetched while it is open. */
export const orderQueueQuery = (search: OrderSearch) =>
  queryOptions({
    queryKey: [
      ...ordersKey(),
      "queue",
      search.stage ?? "new",
      search.branchId ?? "",
      search.q ?? "",
    ],
    queryFn: () => {
      const params = new URLSearchParams({ stage: search.stage ?? "new" });
      if (search.branchId) params.set("branchId", search.branchId);
      if (search.q) params.set("search", search.q);
      return apiFetch(`/orders?${params}`, orderQueue);
    },
    refetchInterval: 15_000,
  });
