import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { importUploadGrant } from "@shopper/assets/schemas";
import { sha256 } from "@shopper/utils";
import { ApiError, apiFetch } from "../../api/client";
import { productImageLink, productImageSet } from "../../schemas/catalogue/detail";
import { currentShop } from "../../stores/shops";
import { productQuery } from "./detail";

/** A link to the photo, refreshed before its five minutes run out; keyed by the photo so a new one reloads. */
export const productImageQuery = (productId: string, assetId: string, shop = currentShop()) =>
  queryOptions({
    queryKey: ["product", shop?.id ?? "box", productId, "image", assetId],
    queryFn: () => apiFetch(`/products/${productId}/image`, productImageLink),
    staleTime: 4 * 60_000,
  });

/** Sends a photo straight to storage with a grant, then links it once the API has checked the bytes. */
export function useUploadImage(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!globalThis.crypto?.subtle)
        throw new Error("Open the portal using HTTPS to upload photos.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const grant = await apiFetch(`/products/${productId}/image/uploads`, importUploadGrant, {
        method: "POST",
        body: {
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          sha256: await sha256(bytes),
        },
      });
      const sent = await fetch(grant.url, {
        method: grant.method,
        headers: grant.headers,
        body: bytes,
        credentials: "omit",
      }).catch(() => {
        throw new ApiError(0, "Couldn't send the photo. Check your connection and try again.");
      });
      if (!sent.ok)
        throw new ApiError(sent.status, "Couldn't store the photo. Choose it again and retry.");
      return linkImage(productId, grant.assetId);
    },
    onSuccess: async () => {
      toast.success("Photo saved");
      await queryClient.invalidateQueries({ queryKey: productQuery(productId).queryKey });
    },
  });
}

/** Takes the photo off the product; the online store shows its placeholder instead. */
export function useRemoveImage(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => linkImage(productId, null),
    onSuccess: async () => {
      toast.success("Photo removed");
      await queryClient.invalidateQueries({ queryKey: productQuery(productId).queryKey });
    },
  });
}

const linkImage = (productId: string, assetId: string | null) =>
  apiFetch(`/products/${productId}/image`, productImageSet, { method: "PUT", body: { assetId } });
