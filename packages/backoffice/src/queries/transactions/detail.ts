import { queryOptions, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { v7 } from "uuid";
import { apiFetch } from "../../api/client";
import { receiptEmailed, transactionDetail } from "../../schemas/transactions";
import { transactionKey } from "./list";

/** One sale's drill-down: lines, tenders, refunds, fiscal documents and audit trail. */
export const transactionQuery = (id: string) =>
  queryOptions({
    queryKey: [...transactionKey(), "detail", id],
    queryFn: () => apiFetch(`/transactions/${id}`, transactionDetail),
  });

/**
 * Emails the receipt again, to the customer's address or the one given. Each click has its own key, so a retried
 * request queues one email.
 */
export function useEmailReceipt(saleId: string) {
  return useMutation({
    mutationFn: (email?: string) =>
      apiFetch(`/transactions/${saleId}/receipt/email`, receiptEmailed, {
        method: "POST",
        body: { requestKey: v7(), ...(email ? { email } : {}) },
      }),
    onSuccess: (sent) =>
      toast.success(
        sent.queued ? `Receipt sent to ${sent.email}` : "That receipt is already on its way",
      ),
  });
}
