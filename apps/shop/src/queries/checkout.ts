import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { shopFetch } from "./api";
import { cartQuote, fulfilmentOptions, placedOrder, shopReviews } from "../schemas/checkout";
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

/** One order, opened with its checkout key (`t`) or the signed review link texted to the shopper (`r`). */
export const orderQuery = (shop: string, id: string, proof: { t?: string; r?: string }) =>
  queryOptions({
    queryKey: [shop, "orders", id],
    queryFn: () =>
      shopFetch(
        `/${shop}/orders/${id}?${new URLSearchParams(proof.t ? { t: proof.t } : { r: proof.r ?? "" })}`,
        placedOrder,
      ),
    // While a payment is open the page follows it: the webhook, not the shopper, finishes it. Once paid, the
    // page follows the store filling the order until it ends.
    refetchInterval: (query) => {
      const order = query.state.data;
      if (order?.status === "placed")
        return order.payment?.status === "pending" || order.payment?.status === "otp"
          ? 3_000
          : false;
      return order &&
        ["paid", "accepted", "picking", "ready", "out_for_delivery"].includes(order.status)
        ? 15_000
        : false;
    },
  });

/** The shop's published reviews: how many, the average and the latest few. */
export const reviewsQuery = (shop: string) =>
  queryOptions({
    queryKey: [shop, "reviews"],
    queryFn: () => shopFetch(`/${shop}/reviews`, shopReviews),
    staleTime: 60_000,
  });
