import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { downloadFile } from "../../lib/download";
import { onPremCancelled, onPremLicence, onPremStarted, onPremView } from "../../schemas/migration";
import { currentShop } from "../../stores/shops";

const KEY = () => ["migration", currentShop()?.id ?? "cloud", "onprem"];

/** The move, followed while the archive seals, while the box works, and until every register has gone over. */
export const onPremQuery = () =>
  queryOptions({
    queryKey: KEY(),
    queryFn: () => apiFetch("/migration/onprem", onPremView),
    refetchInterval: (query) => {
      const move = query.state.data?.move;
      if (!move || move.status === "cancelled") return false;
      if (move.status === "open" && move.archive !== "running") return 10_000;
      if (move.status !== "archived") return 3000;
      return query.state.data!.registers.some((register) => !register.deliveredAt) ? 5000 : false;
    },
  });

/** Starting and calling off change what every member may do: the move and the banner both refresh. */
function useMoveMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["migration"] }),
        queryClient.invalidateQueries({ queryKey: ["billing"] }),
      ]),
  });
}

export const useOnPremStart = () =>
  useMoveMutation(() => apiFetch("/migration/onprem", onPremStarted, { method: "POST" }));

export const useOnPremCancel = () =>
  useMoveMutation(() => apiFetch("/migration/onprem", onPremCancelled, { method: "DELETE" }));

/** The box's licence, issued from the request code its first-boot screen shows. */
export const useOnPremLicence = () =>
  useMoveMutation((request: string) =>
    apiFetch("/migration/onprem/licence", onPremLicence, {
      method: "POST",
      body: { request },
    }),
  );

export function useOnPremArchive() {
  return useMutation({
    mutationFn: (id: string) =>
      downloadFile(`/export/archives/${id}/download`, "archive.shopper", {
        unreachable: "Couldn't reach Shopper. Check the connection and try again.",
        denied: "Your account can't download this archive.",
        failed: "The archive didn't download. Try again.",
      }),
    onError: (failure) => toast.error(failure.message),
  });
}
