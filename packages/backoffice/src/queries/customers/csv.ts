import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadFile } from "../../lib/download";

/** The active customers as customers.csv, with what each owes and the points they hold. */
export function useCustomersCsv() {
  return useMutation({
    mutationFn: () =>
      downloadFile("/customers/export.csv", "customers.csv", {
        unreachable: "Can't reach the server. Check your connection and try again.",
        denied: "Your account can't export customers.",
        failed: "The customers couldn't be exported. Try again.",
      }),
    onError: (failure) => toast.error(failure.message),
  });
}

/** Everyone who owes, aged, as ageing.csv in cedis. */
export function useAgeingCsv() {
  return useMutation({
    mutationFn: () =>
      downloadFile("/customers/ageing.csv", "ageing.csv", {
        unreachable: "Can't reach the server. Check your connection and try again.",
        denied: "Your account can't export ageing.",
        failed: "The ageing couldn't be exported. Try again.",
      }),
    onError: (failure) => toast.error(failure.message),
  });
}
