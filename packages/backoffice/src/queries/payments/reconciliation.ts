import { queryOptions, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { reconciliationView, refreshStarted } from "../../schemas/reconciliation";
import { currentShop } from "../../stores/shops";

/** One trading day's tenders: taken, expected and declared on the Z reports, and what Paystack settled for MoMo. */
export const reconciliationQuery = (day: string, shop = currentShop()) =>
  queryOptions({
    queryKey: ["reconciliation", shop?.id ?? "box", day],
    queryFn: () => apiFetch(`/reconciliation?day=${day}`, reconciliationView),
  });

/** Fetches the day's Paystack settlements again; the figures change once the fetch has run. */
export function useRefreshSettlement() {
  return useMutation({
    mutationFn: (day: string) =>
      apiFetch("/reconciliation/settlements/refresh", refreshStarted, {
        method: "POST",
        body: { day },
      }),
    onSuccess: () =>
      toast.success("Fetching the day's Paystack settlements. Refresh the page in a minute."),
    onError: (error) => toast.error(`Couldn't start the settlement refresh. ${error.message}`),
  });
}
