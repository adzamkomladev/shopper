import { branchList, deletedBarcode, scheduledPrice } from "../../schemas/catalogue/detail";
import type { ProductDetail } from "./types";
export type { ProductDetail, PriceView, BranchView } from "./types";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { priceView, productDetail } from "@shopper/core/schemas";
import { apiFetch } from "../../api/client";
import { currentShop } from "../../stores/shops";
import {
  failureMessage,
  toBarcodeBody,
  toDetailsBody,
  toPriceBody,
  type BarcodeValues,
  type DetailsValues,
  type PriceMode,
  type PriceValues,
} from "../../schemas/product";

export function productQuery(productId: string, shop = currentShop()) {
  return queryOptions({
    queryKey: ["product", shop?.id ?? "box", productId],
    queryFn: () => apiFetch(`/products/${productId}`, productDetail, { shopId: shop?.id ?? null }),
  });
}

/** Branch names for price labels. Roles without branch.read get a 403, so callers must cope without. */
export function branchesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["branches", shop?.id ?? "box"],
    queryFn: () => apiFetch("/branches", branchList, { shopId: shop?.id ?? null }),
    retry: false,
  });
}

// The shop and cache key are read when a write starts, so a shop switch mid-write (or before an
// Undo) cannot send the request or its result to another shop.
const pinShop = (productId: string, shop = currentShop()) => ({
  key: productQuery(productId, shop).queryKey,
  shopId: shop?.id ?? null,
});
type Barcode = ProductDetail["barcodes"][number];

/** Saves the details; the list is refetched because it shows the name, SKU and price. */
export function useSaveProduct(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: DetailsValues) =>
      apiFetch(`/products/${productId}`, productDetail, {
        method: "PATCH",
        body: toDetailsBody(values),
      }),
    onMutate: () => pinShop(productId),
    onSuccess: async (detail, _values, pinned) => {
      queryClient.setQueryData(pinned.key, detail);
      toast.success("Changes saved");
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useAddBarcode(productId: string, onAdded: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: BarcodeValues) => postBarcode(productId, toBarcodeBody(values)),
    onMutate: () => pinShop(productId),
    onSuccess: (barcodes, _values, pinned) => {
      queryClient.setQueryData(pinned.key, (old) => old && { ...old, barcodes });
      toast.success("Barcode added");
      onAdded();
    },
  });
}

/** Removes a barcode. The toast offers Undo, which adds the same code and pack size back. */
export function useRemoveBarcode(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (barcode: Barcode) =>
      apiFetch(
        `/products/${productId}/barcodes/${encodeURIComponent(barcode.code)}`,
        deletedBarcode,
        {
          method: "DELETE",
        },
      ),
    onMutate: () => pinShop(productId),
    onSuccess: (_removed, barcode, pinned) => {
      queryClient.setQueryData(
        pinned.key,
        (old) =>
          old && { ...old, barcodes: old.barcodes.filter((item) => item.code !== barcode.code) },
      );
      toast.success("Barcode removed", {
        action: {
          label: "Undo",
          onClick: () =>
            void postBarcode(productId, barcode, pinned.shopId).then(
              (barcodes) =>
                queryClient.setQueryData(pinned.key, (old) => old && { ...old, barcodes }),
              (error: Error) => toast.error(failureMessage(error)),
            ),
        },
      });
    },
    onError: (error) => toast.error(failureMessage(error)),
  });
}

/** Appends a price version, or a scheduled one. The prices are refetched before the dialog closes. */
export function useSavePrice(productId: string, mode: PriceMode, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: PriceValues) => {
      const body = toPriceBody(mode, values);
      if (mode === "set")
        return apiFetch(`/products/${productId}/prices`, priceView, { method: "POST", body });
      return apiFetch(`/products/${productId}/prices/schedule`, scheduledPrice, {
        method: "POST",
        body,
      });
    },
    onMutate: () => pinShop(productId),
    onSuccess: async (_price, _values, pinned) => {
      await queryClient.invalidateQueries({ queryKey: pinned.key });
      toast.success(mode === "set" ? "Price saved" : "Price scheduled");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

function postBarcode(
  productId: string,
  body: { code: string; quantityThousandths: number },
  shopId = currentShop()?.id ?? null,
) {
  return apiFetch(`/products/${productId}/barcodes`, productDetail.entries.barcodes, {
    method: "POST",
    body,
    shopId,
  });
}
