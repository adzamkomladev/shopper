import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { registerReportSchema } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { rangeError, reportPath } from "../../lib/register/range";
import type { DayRange } from "../../lib/register/types";
import { currentShop } from "../../stores/shops";

const REFRESH_MS = 15_000;

/** This register's sales for a day range. It refreshes, so a sale rung up on another tab shows up. */
export function reportQuery(range: DayRange, shop = currentShop()) {
  return queryOptions({
    queryKey: ["register", shop?.id ?? "box", "report", range.from, range.to],
    queryFn: () => apiFetch(reportPath(range), registerReportSchema, { shopId: shop?.id ?? null }),
    enabled: rangeError(range) === null,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
}
