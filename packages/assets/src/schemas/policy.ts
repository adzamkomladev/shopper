import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const UPLOAD_SECONDS = 900;
export const assetPolicy = {
  catalogue_import: { bucket: "imports", visibility: "private", directUpload: true },
  sync_snapshot: { bucket: "snapshots", visibility: "private", directUpload: false },
} as const;
export const importContentType = v.picklist([
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/vnd.ms-excel",
]);
export const importUploadInput = v.strictObject({
  fileName: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(255),
    // oxlint-disable-next-line no-control-regex -- Reject control bytes in uploaded filenames.
    v.regex(/^[^/\\\x00-\x1f]+\.(csv|xlsx|xls)$/i),
  ),
  contentType: importContentType,
  sizeBytes: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(MAX_IMPORT_BYTES)),
  sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
});
export const assetReference = v.strictObject({ assetId: uuidV7Schema });
export const importUploadGrant = v.object({
  assetId: uuidV7Schema,
  url: v.pipe(v.string(), v.url()),
  method: v.literal("PUT"),
  headers: v.record(v.string(), v.string()),
  expiresAt: v.pipe(v.number(), v.safeInteger()),
});
