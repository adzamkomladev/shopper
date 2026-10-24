import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { downloadFile } from "../../lib/download";
import { taxSummaryView, vatReturnView } from "../../schemas/tax/returns";
import { currentShop } from "../../stores/shops";

const shopKey = () => currentShop()?.id ?? "box";

/** The VAT return worksheet for a month. */
export const vatReturnQuery = (period: string) =>
  queryOptions({
    queryKey: ["tax", shopKey(), "return", period],
    queryFn: () => apiFetch(`/tax/returns/${period}`, vatReturnView),
  });

/** Tax by period, branch and class between two shop dates. */
export const taxSummaryQuery = (range: { from: string; to: string; group: "day" | "month" }) =>
  queryOptions({
    queryKey: ["tax", shopKey(), "summary", range],
    queryFn: () =>
      apiFetch(`/tax/summary?${new URLSearchParams(range).toString()}`, taxSummaryView),
  });

/** Records the input tax claimed; the worksheet is replaced with the server's answer. */
export function useSaveInput(period: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`/tax/returns/${period}/input`, vatReturnView, { method: "PUT", body }),
    onSuccess: (data) => {
      queryClient.setQueryData(vatReturnQuery(period).queryKey, data);
      toast.success("Input tax saved");
    },
  });
}

/** The month's return as an Excel workbook for the accountant. */
export function useReturnWorkbook(period: string) {
  return useMutation({
    mutationFn: () =>
      downloadFile(`/tax/returns/${period}/export.xlsx`, `vat-return-${period}.xlsx`, {
        unreachable: "Can't reach the server. Check your connection and try again.",
        denied: "Your account can't export VAT returns.",
        failed: "The VAT return couldn't be exported. Try again.",
      }),
    onError: (failure) => toast.error(failure.message),
  });
}
