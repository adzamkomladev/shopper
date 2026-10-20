import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { shiftList } from "../../schemas/shifts";
import { currentShop } from "../../stores/shops";

export type { ShiftView } from "../../schemas/shifts";

/** Closed shifts, newest first. */
export function shiftsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["shifts", shop?.id ?? "box"],
    queryFn: () => apiFetch("/shifts", shiftList, { shopId: shop?.id ?? null }),
  });
}
