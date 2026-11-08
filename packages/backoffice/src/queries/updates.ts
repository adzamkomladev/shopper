import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateInstallResponse, updatesResponse } from "@shopper/core/release";
import { deletedBranch as noContent } from "../schemas/branches";
import { apiFetch } from "../api/client";

const WAITING_MS = 3_000;

/** The box's update bundles and last result; polled while a switch is under way. The cloud has none (404). */
export const updatesQuery = (installing = false) =>
  queryOptions({
    queryKey: ["updates"],
    queryFn: () => apiFetch("/updates", updatesResponse),
    retry: false,
    refetchInterval: installing ? WAITING_MS : false,
  });

/** Install now, or after closing at `at`. The box makes a verified backup, then restarts into the new slot. */
export function useUpdateInstall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: string; at?: string }) =>
      apiFetch("/updates/install", updateInstallResponse, { method: "POST", body: input }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["updates"] });
      toast.success(
        result.status === "scheduled"
          ? "Update scheduled. The box makes a backup first, then restarts."
          : "Installing. The box restarts in a moment.",
      );
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateCancel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/updates/cancel", noContent, { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["updates"] }),
    onError: (error) => toast.error(error.message),
  });
}
