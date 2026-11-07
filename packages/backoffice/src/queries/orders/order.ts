import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiFetch } from "../../api/client";
import { staffOrder, type PickBody, type Step } from "../../schemas/orders";
import { ordersKey } from "./queue";

/** One order for the people filling it; refetched while it is open so a new status shows without a reload. */
export const staffOrderQuery = (id: string) =>
  queryOptions({
    queryKey: [...ordersKey(), "order", id],
    queryFn: () => apiFetch(`/orders/${id}`, staffOrder),
    refetchInterval: 15_000,
  });

/** Why a step did not go through, in words for the person at the shelf. */
export const stepMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : "Something went wrong. Try again.";

/** Takes one step with the order (accept, start picking, finish, hand over…); the answer is the order as it now stands. */
export function useOrderStep(id: string, onDone?: (step: Step) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (step: Step) =>
      apiFetch(`/orders/${id}/${step}`, staffOrder, { method: "POST" }).then((order) => ({
        order,
        step,
      })),
    onSuccess: ({ order, step }) => {
      queryClient.setQueryData(staffOrderQuery(id).queryKey, order);
      void queryClient.invalidateQueries({ queryKey: [...ordersKey(), "queue"] });
      onDone?.(step);
    },
    onError: (error) => {
      toast.error(stepMessage(error));
      // The order may have moved under us (another till took it): show where it is now.
      void queryClient.invalidateQueries({ queryKey: staffOrderQuery(id).queryKey });
    },
  });
}

/** Records what was found for one line. */
export function usePickLine(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, body }: { lineId: string; body: PickBody }) =>
      apiFetch(`/orders/${id}/lines/${lineId}`, staffOrder, { method: "PUT", body }),
    onSuccess: (order) => queryClient.setQueryData(staffOrderQuery(id).queryKey, order),
  });
}
