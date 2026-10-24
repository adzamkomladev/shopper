import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { customerView } from "../../schemas/customers/view";

type Action = "archive" | "unarchive";
const DONE: Record<Action, string> = {
  archive: "Customer archived",
  unarchive: "Customer restored",
};

/** Archives or restores a customer. The API refuses with its reason (still owing, holding points, merged); the caller shows it. */
export function useCustomerStatus(id: string, action: Action, onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/customers/${id}/${action}`, customerView, { method: "POST" }),
    onSuccess: async () => {
      toast.success(DONE[action]);
      onDone?.();
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Folds `loserId` into customer `id`: both lists and both pages change. */
export function useMergeCustomers(id: string, onMerged: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (loserId: string) =>
      apiFetch(`/customers/${id}/merge`, customerView, { method: "POST", body: { loserId } }),
    onSuccess: async () => {
      toast.success("Customers merged");
      onMerged();
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
