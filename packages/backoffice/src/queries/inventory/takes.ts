import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { takeDetail, takeList } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { currentShop } from "../../stores/shops";

export const TAKES_PAGE_SIZE = 50;

/** One branch's stock takes, newest first. */
export function takesListQuery(branchId: string, shop = currentShop()) {
  return infiniteQueryOptions({
    queryKey: ["stock", shop?.id ?? "box", "takes", branchId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ branchId, limit: String(TAKES_PAGE_SIZE) });
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch(`/stock/takes?${params}`, takeList, { shopId: shop?.id ?? null });
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** A take's count sheet: while it is open, expected moves with sales; once posted it is what was stored. */
export function takeQuery(id: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["stock", shop?.id ?? "box", "take", id],
    queryFn: () => apiFetch(`/stock/takes/${id}`, takeDetail, { shopId: shop?.id ?? null }),
  });
}

type Start = { id: string; branchId: string; scope: "full" | "category"; categoryId?: string };

/** Opens a take. The body carries the client's id, so sending it again after a failure replays instead of opening two. */
export function useStartTake(onStarted: (id: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Start) => apiFetch("/stock/takes", takeDetail, { method: "POST", body }),
    onSuccess: async (take) => {
      queryClient.setQueryData(takeQuery(take.id).queryKey, take);
      onStarted(take.id);
      await queryClient.invalidateQueries({
        queryKey: ["stock", currentShop()?.id ?? "box", "takes"],
      });
    },
  });
}

/**
 * Saves counts. Saves for one take run one after another (a mutation scope), so a slow answer for an
 * earlier line can never replace a later one in the cache.
 */
export function useCountLines(takeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `take-${takeId}` },
    mutationFn: (counts: { productId: string; countedThousandths: number }[]) =>
      apiFetch(`/stock/takes/${takeId}/counts`, takeDetail, {
        method: "PUT",
        body: { lines: counts },
      }),
    onSuccess: (take) => queryClient.setQueryData(takeQuery(takeId).queryKey, take),
  });
}

/** Posts or cancels a take. Every stock read is refetched: a posted count changes what is on hand. */
export function useCloseTake(takeId: string, action: "post" | "cancel") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/stock/takes/${takeId}/${action}`, takeDetail, { method: "POST", body: {} }),
    onSuccess: async (take) => {
      toast.success(action === "post" ? "Stock take posted" : "Stock take cancelled");
      queryClient.setQueryData(takeQuery(takeId).queryKey, take);
      await queryClient.invalidateQueries({ queryKey: ["stock", currentShop()?.id ?? "box"] });
    },
  });
}
