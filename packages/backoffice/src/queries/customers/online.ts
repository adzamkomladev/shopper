import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { customerView } from "../../schemas/customers/view";

/** Shares a customer's receipts and points with the online store, or stops; every customer view is refetched. */
export function useShareOnline(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) =>
      apiFetch(`/customers/${id}/online`, customerView, { method: "PUT", body: { on } }),
    onSuccess: async (saved) => {
      toast.success(
        saved.onlineShared
          ? `${saved.name} can see receipts and points online`
          : `${saved.name}'s receipts and points stay on this box`,
      );
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error) => toast.error(error.message),
  });
}
