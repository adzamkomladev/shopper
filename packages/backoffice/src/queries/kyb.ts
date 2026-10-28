import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { importUploadGrant } from "@shopper/assets/schemas";
import { sha256 } from "@shopper/utils";
import { ApiError, apiFetch } from "../api/client";
import { kybDraftBody } from "../lib/kyb/values";
import { kybBanks, kybView, type KybValues } from "../schemas/kyb";
import { currentShop } from "../stores/shops";

export const kybQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["kyb", shop?.id ?? "box"],
    queryFn: () => apiFetch("/kyb", kybView, { shopId: shop?.id ?? null }),
    retry: false,
  });

export const kybBanksQuery = () =>
  queryOptions({
    queryKey: ["kyb", "banks"],
    queryFn: () => apiFetch("/kyb/banks", kybBanks),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

/**
 * Saves what is filled in; submitting saves first, then sends the whole case to Shopper. The shop is read once,
 * so switching shops mid-request can neither submit nor cache the other shop's case.
 */
export function useSaveKyb() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, submit }: { values: KybValues; submit: boolean }) => {
      const shop = currentShop();
      const shopId = shop?.id ?? null;
      const saved = await apiFetch("/kyb", kybView, {
        method: "PUT",
        body: kybDraftBody(values),
        shopId,
      });
      const view = submit
        ? await apiFetch("/kyb/submit", kybView, { method: "POST", body: {}, shopId })
        : saved;
      return { shop, view };
    },
    onSuccess: ({ shop, view }, { submit }) => {
      queryClient.setQueryData(kybQuery(shop).queryKey, view);
      toast.success(submit ? "Sent to Shopper for review" : "Draft saved");
    },
  });
}

/** Sends one scan or certificate straight to storage and answers the asset id the case refers to. */
export function useUploadKybFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!globalThis.crypto?.subtle)
        throw new Error("Open the portal using HTTPS to upload files.");
      const shopId = currentShop()?.id ?? null;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const grant = await apiFetch("/kyb/documents", importUploadGrant, {
        method: "POST",
        shopId,
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
        throw new ApiError(0, "Couldn't send the file. Check your connection and try again.");
      });
      if (!sent.ok) throw new ApiError(sent.status, "Couldn't store the file. Choose it again.");
      return grant.assetId;
    },
  });
}
