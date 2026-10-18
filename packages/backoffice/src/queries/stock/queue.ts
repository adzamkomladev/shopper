import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import type { StockDraft } from "./types";
import { stockQueue, queuedStock } from "../../schemas/stock/queue";
import { currentShop } from "../../stores/shops";

const REFRESH_MS = 5_000;

const queueKey = (shop = currentShop()) => ["stock", shop?.id ?? "box", "queue"];

/** The register's stock documents, newest first. It refreshes while the upload worker settles them. */
export function stockQueueQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: queueKey(shop),
    queryFn: () => apiFetch("/register/stock", stockQueue, { shopId: shop?.id ?? null }),
    refetchInterval: REFRESH_MS,
  });
}

/** Queues a count or receipt on the register; the host stamps who and when it was entered. */
export function useQueueStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: StockDraft) => {
      const at = new Date().toISOString();
      const body =
        draft.kind === "count" ? { ...draft, countedAt: at } : { ...draft, receivedAt: at };
      return apiFetch("/register/stock", queuedStock, { method: "POST", body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queueKey() }),
  });
}
