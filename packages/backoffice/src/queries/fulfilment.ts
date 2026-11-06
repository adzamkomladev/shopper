import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api/client";
import { fulfilmentView, toFulfilmentBody, type FulfilmentValues } from "../schemas/fulfilment";

export const fulfilmentQuery = (branchId: string) =>
  queryOptions({
    queryKey: ["branches", branchId, "fulfilment"],
    queryFn: () => apiFetch(`/branches/${branchId}/fulfilment`, fulfilmentView),
  });

/** Saves how the branch takes online orders. */
export function useSaveFulfilment(branchId: string, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: FulfilmentValues) =>
      apiFetch(`/branches/${branchId}/fulfilment`, fulfilmentView, {
        method: "PUT",
        body: toFulfilmentBody(values),
      }),
    onSuccess: (saved) => {
      toast.success("Online orders saved");
      queryClient.setQueryData(fulfilmentQuery(branchId).queryKey, saved);
      onSaved();
    },
  });
}
