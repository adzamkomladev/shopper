import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { shiftDetail } from "../../schemas/shifts";
import { currentShop } from "../../stores/shops";

/** One closed shift with its stored Z report. */
export function shiftQuery(shiftId: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["shifts", shop?.id ?? "box", "detail", shiftId],
    queryFn: () => apiFetch(`/shifts/${shiftId}`, shiftDetail, { shopId: shop?.id ?? null }),
  });
}
