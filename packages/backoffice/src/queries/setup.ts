import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api/client";
import { setup, type Setup } from "../schemas/setup";
import { currentShop } from "../stores/shops";

export const setupQuery = () =>
  queryOptions({
    queryKey: ["setup", currentShop()?.id ?? "box"],
    queryFn: () => apiFetch("/setup", setup),
  });

/** An owner whose shop is still being set up, who has not finished or left the wizard, starts there. */
export const startsInSetup = (progress: Setup, held: string[]) =>
  progress.status === "setup" &&
  !progress.finished &&
  !progress.skipped &&
  held.includes("store.write");

/** Skips Products, finishes or leaves the wizard; the answer is the new progress. */
export function useSetupMove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (move: "products/skip" | "finish" | "dismiss") =>
      apiFetch(`/setup/${move}`, setup, { method: "POST", body: {} }),
    onSuccess: (progress) => queryClient.setQueryData(setupQuery().queryKey, progress),
    onError: (error) => toast.error(error.message),
  });
}

/** After a step's own form saves, read the progress again. */
export function useRefreshSetup() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: setupQuery().queryKey });
}
