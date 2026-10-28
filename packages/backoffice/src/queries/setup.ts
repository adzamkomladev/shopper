import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api/client";
import { setup, type Setup } from "../schemas/setup";
import { currentShop } from "../stores/shops";

export const setupQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["setup", shop?.id ?? "box"],
    queryFn: () => apiFetch("/setup", setup, { shopId: shop?.id ?? null }),
  });

/** An owner whose shop is still being set up, who has not finished or left the wizard, starts there. */
export const startsInSetup = (progress: Setup, held: string[]) =>
  progress.status === "setup" &&
  !progress.finished &&
  !progress.skipped &&
  held.includes("store.write");

/**
 * Skips Products, finishes or leaves the wizard; the answer is the new progress. The shop is read once, so
 * switching shops mid-request cannot move or cache the other shop's setup.
 */
export function useSetupMove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (move: "products/skip" | "finish" | "dismiss") => {
      const shop = currentShop();
      const progress = await apiFetch(`/setup/${move}`, setup, {
        method: "POST",
        body: {},
        shopId: shop?.id ?? null,
      });
      return { shop, progress };
    },
    onSuccess: (moved) => queryClient.setQueryData(setupQuery(moved.shop).queryKey, moved.progress),
    onError: (error) => toast.error(error.message),
  });
}

/** After a step's own form saves, read the progress again. */
export function useRefreshSetup() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: setupQuery().queryKey });
}
