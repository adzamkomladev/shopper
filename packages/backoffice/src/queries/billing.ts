import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../api/client";
import { billingStatus, billingView, licenceView } from "../schemas/billing";
import { formatDay } from "@shopper/utils";
import { currentShop } from "../stores/shops";

const STATUS_MS = 60_000;

/** The Shopper subscription and its invoices with their payment links. */
export const billingQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["billing", shop?.id ?? "box"],
    queryFn: () => apiFetch("/billing", billingView),
  });

/** Whether an unpaid invoice has made the back office read-only: the shell's banner. */
export const billingStatusQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["billing", shop?.id ?? "box", "status"],
    queryFn: () => apiFetch("/billing/status", billingStatus),
    staleTime: STATUS_MS,
  });

/** The box checks its licence in now; a confirmed check-in reopens a read-only back office at once. */
export function useLicenceCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/licence/checks", licenceView, { method: "POST", body: {} }),
    onSuccess: (licence) => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      if (licence.error) return toast.error(licence.error);
      if (licence.state === "valid" && licence.locksAt)
        return toast.success(`Checked in. Next check-in due by ${formatDay(licence.locksAt)}.`);
      toast.error("Shopper did not confirm the licence. Try again, or contact Shopper support.");
    },
    onError: (error) => toast.error(error.message),
  });
}
