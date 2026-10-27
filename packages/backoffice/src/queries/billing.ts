import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { billingStatus, billingView } from "../schemas/billing";
import { currentShop } from "../stores/shops";

const STATUS_MS = 60_000;

/** The Shopper subscription and its invoices with their payment links. */
export const billingQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["billing", shop?.id ?? "box"],
    queryFn: () => apiFetch("/billing", billingView),
  });

/** Whether an unpaid invoice has made the back office read-only: the shell's banner. */
export const billingStatusQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["billing", shop?.id ?? "box", "status"],
    queryFn: () => apiFetch("/billing/status", billingStatus),
    staleTime: STATUS_MS,
  });
