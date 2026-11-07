import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { shopFetch } from "./api";
import { cartQuote, fulfilmentOptions, placedOrder } from "../schemas/checkout";
import type { CartLine } from "../schemas/cart";

// Keys start with the shop code, so one browser shopping at two shops never mixes them.
export const cartQuery = (
  shop: string,
  branch: string | undefined,
  lines: CartLine[],
  fulfilment: "pickup" | "delivery" = "pickup",
) =>
  queryOptions({
    queryKey: [shop, "cart", branch, fulfilment, lines],
    queryFn: () => shopFetch(`/${shop}/cart`, cartQuote, { body: { branch, lines, fulfilment } }),
    enabled: lines.length > 0,
    // A changed quantity keeps the last total on screen while the new one is priced.
    placeholderData: keepPreviousData,
  });

export const fulfilmentQuery = (shop: string, branch: string | undefined) =>
  queryOptions({
    queryKey: [shop, "fulfilment", branch],
    queryFn: () =>
      shopFetch(`/${shop}/fulfilment${branch ? `?branch=${branch}` : ""}`, fulfilmentOptions),
  });

export const orderQuery = (shop: string, id: string, key: string) =>
  queryOptions({
    queryKey: [shop, "orders", id],
    queryFn: () => shopFetch(`/${shop}/orders/${id}?t=${key}`, placedOrder),
    // While a payment is open the page follows it: the webhook, not the shopper, finishes it.
    refetchInterval: (query) =>
      query.state.data?.status === "placed" && query.state.data.payment?.status === "pending"
        ? 3_000
        : false,
  });
