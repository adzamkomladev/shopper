import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { moveStarted, moveView } from "../../schemas/migration";
import { currentShop } from "../../stores/shops";

/** The move, followed every couple of seconds while it runs and while a register has yet to follow it. */
export const moveQuery = () =>
  queryOptions({
    queryKey: ["migration", currentShop()?.id ?? "box", "move"],
    queryFn: () => apiFetch("/migration/move", moveView),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.move || data.move.status === "failed") return false;
      if (data.move.status !== "moved") return 2000;
      return data.registers.some((register) => !register.deliveredAt) ? 5000 : false;
    },
  });

export function useMoveStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cloudUrl: string) =>
      apiFetch("/migration/move", moveStarted, { method: "POST", body: { cloudUrl } }),
    // The banner reads the move from the billing status: both refresh.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["migration"] }),
        queryClient.invalidateQueries({ queryKey: ["billing"] }),
      ]),
  });
}
