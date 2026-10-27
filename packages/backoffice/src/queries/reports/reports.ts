import { queryOptions, useMutation } from "@tanstack/react-query";
import type * as v from "valibot";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { downloadFile } from "../../lib/download";
import { reportViews as views, scopeView, type ReportKind } from "../../schemas/reports/views";
import { currentShop } from "../../stores/shops";

const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ).toString();

/** One report for the current shop, keyed by its parameters (the range, the branch, the grouping). */
export const reportQuery = <K extends ReportKind>(
  kind: K,
  params: Record<string, string | undefined>,
) =>
  queryOptions({
    queryKey: ["reports", currentShop()?.id ?? "box", kind, params],
    queryFn: () =>
      apiFetch(`/reports/${kind}?${query(params)}`, views[kind]) as Promise<
        v.InferOutput<(typeof views)[K]>
      >,
  });

/** The branches this reader may report on: a scoped member's own, else every branch. */
export const reportScopeQuery = () =>
  queryOptions({
    queryKey: ["reports", currentShop()?.id ?? "box", "scope"],
    queryFn: () => apiFetch("/reports/scope", scopeView),
  });

/** Downloads the report as shown, as CSV or Excel, under the server's file name. */
export function useReportExport(kind: ReportKind, params: Record<string, string | undefined>) {
  return useMutation({
    mutationFn: (format: "csv" | "xlsx") =>
      downloadFile(
        `/reports/${kind}/export.${format}?${query(params)}`,
        `${kind.replace("/", "-")}-${params.from ?? params.day ?? params.on ?? "today"}.${format}`,
        {
          unreachable: "Can't reach the server. Check your connection and try again.",
          denied: "Your account can't export this report.",
          failed: "The report couldn't be exported. Try again.",
        },
      ),
    onError: (failure) => toast.error(failure.message),
  });
}
