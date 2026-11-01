import { queryOptions } from "@tanstack/react-query";
import { shopFetch } from "./api";
import { shopAccount, shopAddresses, shopPoints, shopReceipt, shopReceipts } from "../schemas/shop";

// Keys start with the shop code, so one browser signed in at two shops never mixes them.
export const accountQuery = (shop: string) =>
  queryOptions({ queryKey: [shop, "account"], queryFn: () => shopFetch("/account", shopAccount) });

export const pointsQuery = (shop: string) =>
  queryOptions({
    queryKey: [shop, "points"],
    queryFn: () => shopFetch("/account/points", shopPoints),
  });

export const receiptsQuery = (shop: string) =>
  queryOptions({
    queryKey: [shop, "receipts"],
    queryFn: () => shopFetch("/account/receipts", shopReceipts),
  });

export const receiptQuery = (shop: string, saleId: string) =>
  queryOptions({
    queryKey: [shop, "receipts", saleId],
    queryFn: () => shopFetch(`/account/receipts/${encodeURIComponent(saleId)}`, shopReceipt),
  });

export const addressesQuery = (shop: string) =>
  queryOptions({
    queryKey: [shop, "addresses"],
    queryFn: () => shopFetch("/account/addresses", shopAddresses),
  });
