import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { approvalList, approvalRow, type ApprovalDecision } from "../../schemas/approvals";
import { currentShop } from "../../stores/shops";

const key = (shop = currentShop()) => ["approvals", shop?.id ?? "box", "pending"] as const;
/** A request waits at most ten minutes, so the inbox looks again every few seconds while it is open. */
const REFRESH_MS = 5_000;

/** Requests from the tills that wait for this member's answer, newest first. */
export const pendingApprovalsQuery = () =>
  queryOptions({
    queryKey: key(),
    queryFn: () => apiFetch("/approvals?status=pending", approvalList),
    refetchInterval: REFRESH_MS,
  });

/** Approves or declines; the answer leaves the inbox at once and reaches the till live. */
export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ApprovalDecision }) =>
      apiFetch(`/approvals/${id}/decision`, approvalRow, { method: "POST", body: decision }),
    onSuccess: (saved) => {
      queryClient.setQueryData(pendingApprovalsQuery().queryKey, (list) =>
        list ? { approvals: list.approvals.filter((row) => row.id !== saved.id) } : list,
      );
      toast.success(
        saved.status === "approved"
          ? "Approved. The till can go ahead."
          : "Declined. The till has been told.",
      );
    },
    onError: (error) => toast.error(error.message),
  });
}
