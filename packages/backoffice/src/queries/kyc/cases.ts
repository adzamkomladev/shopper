import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { kycDetail, kycList, subjectCustomer, subjectCustomers } from "../../schemas/kyc";
import { currentShop } from "../../stores/shops";

const key = (shop: ReturnType<typeof currentShop>, ...rest: string[]) =>
  ["kyc", shop?.id ?? "box", ...rest] as const;

/** Every case, newest first (the API returns the latest 200); the queue sorts them into its segments. */
export function kycListQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: key(shop, "list"),
    queryFn: () => apiFetch("/kyc", kycList, { shopId: shop?.id ?? null }),
  });
}

/** One case with the other checks that carry the same ID. */
export function kycCaseQuery(id: string, shop = currentShop()) {
  return queryOptions({
    queryKey: key(shop, "case", id),
    queryFn: () => apiFetch(`/kyc/${id}`, kycDetail, { shopId: shop?.id ?? null }),
  });
}

/** The customer a credit check is for. A member without `customer.read` falls back to the phone. */
export function kycSubjectQuery(customerId: string, shop = currentShop()) {
  return queryOptions({
    queryKey: key(shop, "subject", customerId),
    queryFn: () =>
      apiFetch(`/customers/${customerId}`, subjectCustomer, { shopId: shop?.id ?? null }),
    retry: false,
  });
}

// ponytail: the newest 200 customers. Start a check from the customer's own page for anyone older.
/** The customers a new check can be for. */
export function kycCustomersQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: key(shop, "customers"),
    queryFn: () => apiFetch("/customers?limit=200", subjectCustomers, { shopId: shop?.id ?? null }),
  });
}
