import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { dryRun, dryRunStarted } from "../../schemas/migration";
import { currentShop } from "../../stores/shops";

/** A dry run's verdict, followed while its archive seals. */
export const dryRunQuery = (id: string) =>
  queryOptions({
    queryKey: ["migration", currentShop()?.id ?? "here", "dryrun", id],
    queryFn: () => apiFetch(`/migration/dryrun/${id}`, dryRun),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });

/** Starts a dry run; the move view's checks refresh with it. */
export function useDryRunStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/migration/dryrun", dryRunStarted, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["migration"] }),
  });
}
