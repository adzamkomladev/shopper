import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import {
  fiscalArchivesView,
  fiscalDocView,
  fiscalListView,
  type FiscalSearch,
} from "../../schemas/tax/fiscal";
import { currentShop } from "../../stores/shops";

const key = (shop = currentShop()) => ["tax", shop?.id ?? "box", "fiscal"] as const;

/** One segment of the fiscal documents, newest first, with every segment's count. */
export const fiscalListQuery = (search: Pick<FiscalSearch, "status" | "q">) => {
  const params = new URLSearchParams({ status: search.status ?? "all" });
  if (search.q) params.set("q", search.q);
  return queryOptions({
    queryKey: [...key(), "list", search.status ?? "all", search.q ?? ""],
    queryFn: () => apiFetch(`/tax/fiscal?${params}`, fiscalListView),
  });
};

export const fiscalDocQuery = (id: string) =>
  queryOptions({
    queryKey: [...key(), "doc", id],
    queryFn: () => apiFetch(`/tax/fiscal/${id}`, fiscalDocView),
  });

/** One shop day's hourly archive bundles. Read again before their 5-minute download links expire. */
export const fiscalArchivesQuery = (date: string) =>
  queryOptions({
    queryKey: [...key(), "archives", date],
    queryFn: () => apiFetch(`/tax/fiscal/archives?date=${date}`, fiscalArchivesView),
    refetchInterval: 4 * 60_000,
  });

/** Puts a dead-lettered document back in its store's queue; every fiscal view is read again. */
export function useRetryFiscal(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/tax/fiscal/${id}/retry`, fiscalDocView, { method: "POST" }),
    onSuccess: async () => {
      toast.success("Sent back to the SDC queue");
      onDone();
      await queryClient.invalidateQueries({ queryKey: key() });
    },
  });
}
