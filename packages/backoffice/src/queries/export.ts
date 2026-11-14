import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api/client";
import { downloadFile } from "../lib/download";
import { archiveList, entityList, started, type EntityName } from "../schemas/export";
import { currentShop } from "../stores/shops";

const POLL_MS = 2000;
const messages = {
  unreachable: "Can't reach the server. Check your connection and try again.",
  denied: "Your account can't export this data.",
  failed: "The export couldn't be made. Try again.",
};

export const exportEntitiesQuery = () =>
  queryOptions({
    queryKey: ["export", currentShop()?.id ?? "box", "entities"],
    queryFn: () => apiFetch("/export/entities", entityList),
  });

/** The archives, refreshed every couple of seconds while one is being prepared. */
export const archivesQuery = () =>
  queryOptions({
    queryKey: ["export", currentShop()?.id ?? "box", "archives"],
    queryFn: () => apiFetch("/export/archives", archiveList),
    refetchInterval: (query) =>
      query.state.data?.archives.some((archive) => archive.status === "running") ? POLL_MS : false,
  });

/** One entity as CSV or Excel for the dates chosen, under the server's file name. */
export function useEntityDownload() {
  return useMutation({
    mutationFn: (input: {
      entity: EntityName;
      format: "csv" | "xlsx";
      from?: string;
      to?: string;
    }) => {
      const range = input.from && input.to ? `?from=${input.from}&to=${input.to}` : "";
      const name = [input.entity, input.from, input.to].filter(Boolean).join("-");
      return downloadFile(
        `/export/entities/${input.entity}.${input.format}${range}`,
        `${name}.${input.format}`,
        messages,
      );
    },
    onError: (failure) => toast.error(failure.message),
  });
}

export function useArchiveStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/export/archives", started, { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["export"] }),
    onError: (failure) => toast.error(failure.message),
  });
}

export function useArchiveDownload() {
  return useMutation({
    mutationFn: (input: { id: string; day: string }) =>
      downloadFile(
        `/export/archives/${input.id}/download`,
        `shopper-archive-${input.day}.shopper`,
        messages,
      ),
    onError: (failure) => toast.error(failure.message),
  });
}

export function useArchiveDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/export/archives/${id}`, started, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Archive deleted.");
      return queryClient.invalidateQueries({ queryKey: ["export"] });
    },
    onError: (failure) => toast.error(failure.message),
  });
}
