import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type * as v from "valibot";
import { importPreview, importResult } from "@shopper/core/schemas";
import { ApiError, apiFetch } from "../../api/client";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export type ImportPreview = v.InferOutput<typeof importPreview>;
export type ImportResult = v.InferOutput<typeof importResult>;

function sheetBody(file: File) {
  const body = new FormData();
  body.set("file", file);
  return body;
}

/** The dry run: reads the file and reports what an import would do. Nothing is written. */
export function useCheckImport() {
  return useMutation({
    mutationFn: (file: File) =>
      apiFetch("/catalogue/imports?dryRun=1", importPreview, {
        method: "POST",
        body: sheetBody(file),
      }),
  });
}

const MAY_HAVE_FINISHED = "The import may have finished. Check Products before importing again.";

/** The real import. The lists are refetched either way: even a failed request may have written. */
export function useRunImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      try {
        return await apiFetch("/catalogue/imports", importResult, {
          method: "POST",
          body: sheetBody(file),
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
