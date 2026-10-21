import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { documentDetail, documentList, stockList } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { KINDS } from "../../lib/inventory/records";
import { currentShop } from "../../stores/shops";
import type { RecordsSearch } from "./types";

export const RECORDS_PAGE_SIZE = 50;
const SEARCH_RESULTS = 8;

type Filters = { branchId: string; kind?: RecordsSearch["kind"] };

/** One branch's stock records newest first, each page with the count of every kind. */
export function recordsListQuery({ branchId, kind }: Filters, shop = currentShop()) {
  return infiniteQueryOptions({
    queryKey: ["stock", shop?.id ?? "box", "records", branchId, kind ?? "all"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ branchId, limit: String(RECORDS_PAGE_SIZE) });
      const api = KINDS.find((entry) => entry.kind === kind)?.api;
      if (api) params.set("kind", api);
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch(`/stock/documents?${params}`, documentList, { shopId: shop?.id ?? null });
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** One record with the lines it posted. */
export function recordQuery(id: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["stock", shop?.id ?? "box", "record", id],
    queryFn: () => apiFetch(`/stock/documents/${id}`, documentDetail, { shopId: shop?.id ?? null }),
  });
}

/** The products of a branch matching a name, SKU or barcode, for the lines of a receipt or adjustment. */
export const stockFindQuery =
  (branchId: string, shop = currentShop()) =>
  (search: string) =>
    queryOptions({
      queryKey: ["stock", shop?.id ?? "box", "find", branchId, search],
      queryFn: async () => {
        const params = new URLSearchParams({ branchId, q: search, limit: String(SEARCH_RESULTS) });
        const page = await apiFetch(`/stock?${params}`, stockList, { shopId: shop?.id ?? null });
        return page.items;
      },
      enabled: search.trim().length > 0,
      placeholderData: keepPreviousData,
    });

type Saved = "receipts" | "adjustments";

/**
 * Posts a receipt or adjustment. The body carries the client's record id, so sending it again
 * after a failure replays instead of doubling stock. Every stock read is refetched.
 */
export function useSaveRecord(path: Saved, onSaved: (id: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: object) =>
      apiFetch(`/stock/${path}`, documentDetail, { method: "POST", body }),
    onSuccess: async (record) => {
      toast.success(path === "receipts" ? "Stock received" : "Stock adjusted");
      queryClient.setQueryData(recordQuery(record.id).queryKey, record);
      onSaved(record.id);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
  });
}
