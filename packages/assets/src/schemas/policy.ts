import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_BYTES = 1024 * 1024;
export const MAX_KYB_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;
export const UPLOAD_SECONDS = 900;
export const assetPolicy = {
  catalogue_import: { bucket: "imports", visibility: "private", directUpload: true },
  sync_snapshot: { bucket: "snapshots", visibility: "private", directUpload: false },
  sale_receipt: { bucket: "receipts", visibility: "private", directUpload: true },
  // Kept as long as the shop, in the durable private store receipts use; no bucket of its own.
  kyb_document: { bucket: "receipts", visibility: "private", directUpload: true },
  // Served to the store only through short download grants, never publicly listed.
  product_image: { bucket: "receipts", visibility: "private", directUpload: true },
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
export const receiptUploadInput = v.strictObject({
  saleId: uuidV7Schema,
  size: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
});
export const kybUploadInput = v.strictObject({
  fileName: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(255),
    // oxlint-disable-next-line no-control-regex -- Reject control bytes in uploaded filenames.
    v.regex(/^[^/\\\x00-\x1f]+\.(pdf|jpe?g|png)$/i),
  ),
  contentType: v.picklist(["application/pdf", "image/jpeg", "image/png"]),
  sizeBytes: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(MAX_KYB_BYTES)),
  sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
});
export const productImageUploadInput = v.strictObject({
  fileName: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(255),
    // oxlint-disable-next-line no-control-regex -- Reject control bytes in uploaded filenames.
    v.regex(/^[^/\\\x00-\x1f]+\.(jpe?g|png|webp)$/i),
  ),
  contentType: v.picklist(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: v.pipe(
    v.number(),
    v.safeInteger(),
    v.minValue(1),
    v.maxValue(MAX_PRODUCT_IMAGE_BYTES),
  ),
  sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
});
/** The photo to show, or null to remove it. */
export const productImageInput = v.strictObject({ assetId: v.nullable(uuidV7Schema) });
