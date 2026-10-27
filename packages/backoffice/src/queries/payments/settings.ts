import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { paymentSettingsView, type PaymentSettingsView } from "../../schemas/payments";
import { currentShop } from "../../stores/shops";

export const paymentSettingsQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["settings", shop?.id ?? "box", "payments"],
    queryFn: () => apiFetch("/settings/payments", paymentSettingsView),
  });

/** Switches the MoMo provider; new charges use it from the next sale. */
export function useSavePaymentSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (momoProvider: PaymentSettingsView["momoProvider"]) =>
      apiFetch("/settings/payments", paymentSettingsView, {
        method: "PUT",
        body: { momoProvider },
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(paymentSettingsQuery().queryKey, saved);
      toast.success("Payment settings saved");
    },
  });
}
