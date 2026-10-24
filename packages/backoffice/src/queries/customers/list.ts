import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { customerPage, customerView } from "../../schemas/customers/view";
import { currentShop } from "../../stores/shops";
import type { CustomersSearch } from "./types";

const PAGE_SIZE = 50;

/** Customers newest first, a page at a time. Keyed by shop and filters, so none share a list. */
export function customersListQuery({ q, segment }: CustomersSearch = {}, shop = currentShop()) {
  return infiniteQueryOptions({
    queryKey: ["customers", shop?.id ?? "box", "list", q ?? "", segment ?? "active"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (segment === "archived") params.set("archived", "1");
      if (segment === "business") params.set("kind", "business");
      if (segment === "account") params.set("onAccount", "1");
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch(`/customers?${params}`, customerPage, { shopId: shop?.id ?? null });
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** One customer with the balance and points folded from their ledgers. */
export function customerQuery(id: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["customers", shop?.id ?? "box", "one", id],
    queryFn: () => apiFetch(`/customers/${id}`, customerView, { shopId: shop?.id ?? null }),
  });
}

/** The first page of active customers matching a phone number or name, for the shared-phone flag and the merge picker. */
export function customerSearchQuery(q: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["customers", shop?.id ?? "box", "find", q],
    queryFn: () =>
      apiFetch(`/customers?${new URLSearchParams({ q, limit: "10" })}`, customerPage, {
        shopId: shop?.id ?? null,
      }),
  });
}
