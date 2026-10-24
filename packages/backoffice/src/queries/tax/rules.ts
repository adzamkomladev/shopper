import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { removedRule, taxRuleView, taxRulesView } from "../../schemas/tax/rules";
import { currentShop } from "../../stores/shops";

const key = (shop = currentShop()) => ["tax", shop?.id ?? "box", "rules"] as const;

/** Every dated rule of the org, the latest start first. */
export const taxRulesQuery = () =>
  queryOptions({ queryKey: key(), queryFn: () => apiFetch("/tax/rules", taxRulesView) });

/** Schedules a rule (no `id`) or changes a scheduled one; the list is read again either way. */
export function useSaveRule(id: string | undefined, onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(id ? `/tax/rules/${id}` : "/tax/rules", taxRuleView, {
        method: id ? "PATCH" : "POST",
        body,
      }),
    onSuccess: async () => {
      toast.success(id ? "Rule updated" : "Rule scheduled");
      onDone();
      await queryClient.invalidateQueries({ queryKey: key() });
    },
  });
}

/** Removes a rule that has not started. */
export function useDeleteRule(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/tax/rules/${id}`, removedRule, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Rule removed");
      onDone();
      await queryClient.invalidateQueries({ queryKey: key() });
    },
  });
}
