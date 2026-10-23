import { queryOptions } from "@tanstack/react-query";
import type * as v from "valibot";
import { apiFetch } from "../../api/client";
import {
  ageingReport,
  customerLoyalty,
  customerSales,
  statementDeliveries,
  statementLinks,
  statementView,
} from "../../schemas/customers/account";
import { currentShop } from "../../stores/shops";

// Every key starts ["customers", shop], so a change to any customer refetches what is on screen.
const key = (shop: ReturnType<typeof currentShop>, id: string, ...rest: string[]) => [
  "customers",
  shop?.id ?? "box",
  "one",
  id,
  ...rest,
];
const read = <S extends v.GenericSchema>(
  path: string,
  schema: S,
  shop: ReturnType<typeof currentShop>,
) => apiFetch(path, schema, { shopId: shop?.id ?? null });

/** The account between two days: what was owed before, each entry with the balance after it, and what is owed at the end. */
export function statementQuery(id: string, from: string, to: string, shop = currentShop()) {
  return queryOptions({
    retry: false,
    queryKey: key(shop, id, "statement", from, to),
    queryFn: () =>
      read(`/customers/${id}/statement?${new URLSearchParams({ from, to })}`, statementView, shop),
  });
}

/** The links made for this customer's statements, newest first, with whether each was opened. */
export function statementLinksQuery(id: string, shop = currentShop()) {
  return queryOptions({
    retry: false,
    queryKey: key(shop, id, "links"),
    queryFn: () => read(`/customers/${id}/statement/links`, statementLinks, shop),
  });
}

/** The statements sent to them, newest first. */
export function statementDeliveriesQuery(id: string, shop = currentShop()) {
  return queryOptions({
    retry: false,
    queryKey: key(shop, id, "deliveries"),
    queryFn: () => read(`/customers/${id}/statements`, statementDeliveries, shop),
  });
}

/** What they bought, newest first. */
export function customerSalesQuery(id: string, shop = currentShop()) {
  return queryOptions({
    retry: false,
    queryKey: key(shop, id, "sales"),
    queryFn: () => read(`/customers/${id}/sales`, customerSales, shop),
  });
}

/** Their points with the balance after each entry, their tier and the tier they are about to lose. */
export function customerLoyaltyQuery(id: string, shop = currentShop()) {
  return queryOptions({
    retry: false,
    queryKey: key(shop, id, "loyalty"),
    queryFn: () => read(`/customers/${id}/loyalty`, customerLoyalty, shop),
  });
}

/** Every customer who owes, with what is overdue by how long. */
export function ageingQuery(shop = currentShop()) {
  return queryOptions({
    retry: false,
    queryKey: ["customers", shop?.id ?? "box", "ageing"],
    queryFn: () => read("/customers/ageing", ageingReport, shop),
  });
}
