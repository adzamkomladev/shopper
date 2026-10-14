export type { ImportPreview, ImportResult } from "./types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import * as v from "valibot";
import { importContentType, importUploadGrant } from "@shopper/assets/schemas";
import { sha256 } from "@shopper/utils";
import { importPreview, importResult } from "@shopper/core/schemas";
import { ApiError, apiFetch } from "../../api/client";

export { MAX_IMPORT_BYTES as MAX_FILE_BYTES } from "@shopper/assets/schemas";

/** Upload once; the preview and final import use the same registered asset. */
export function useCheckImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!globalThis.crypto?.subtle)
        throw new Error("Open the portal using HTTPS to upload files.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const grant = await apiFetch("/catalogue/imports/uploads", importUploadGrant, {
        method: "POST",
        body: {
          fileName: file.name,
          contentType: v.is(importContentType, file.type) ? file.type : "application/octet-stream",
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
      if (!sent.ok)
        throw new ApiError(
          sent.status,
          "Couldn't store the file. Choose the file again and retry.",
        );
      const preview = await apiFetch("/catalogue/imports?dryRun=1", importPreview, {
        method: "POST",
        body: { assetId: grant.assetId },
      });
      return { ...preview, assetId: grant.assetId };
    },
  });
}

const MAY_HAVE_FINISHED = "The import may have finished. Check Products before importing again.";

/** The real import. The lists are refetched either way: even a failed request may have written. */
export function useRunImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assetId: string) => {
      try {
        return await apiFetch("/catalogue/imports", importResult, {
          method: "POST",
          body: { assetId },
        });
      } catch (error) {
        throw unsureOutcome(error);
      }
    },
    onSuccess: (result) =>
      toast.success(
        result.rowsOk === 1 ? "1 product imported" : `${result.rowsOk} products imported`,
      ),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
    },
  });
}

/** A dropped connection or an unreadable 2xx reply says nothing about whether the rows were written. */
function unsureOutcome(error: unknown) {
  if (!(error instanceof ApiError)) return error;
  if (error.status === 0)
    return new ApiError(0, `${error.message} ${MAY_HAVE_FINISHED}`, undefined, { cause: error });
  if (error.status < 300)
    return new ApiError(error.status, MAY_HAVE_FINISHED, undefined, { cause: error });
  return error;
}

/** What to tell the owner when a check or an import fails. */
export function importFailure(error: Error) {
  if (!(error instanceof ApiError)) return error.message;
  if (error.status === 403)
    return "You don't have permission to import products. Ask the shop owner.";
  if (error.status === 400)
    return `We couldn't read that file. Save it as .csv or .xlsx and try again. ${error.message}`;
  if (error.status === 413) return "That file is larger than 10 MB. Split it into smaller files.";
  if (error.status >= 500) return "Something went wrong on our side. Try again in a minute.";
  return error.message;
}
