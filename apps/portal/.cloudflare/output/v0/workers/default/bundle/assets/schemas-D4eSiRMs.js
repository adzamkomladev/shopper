import {
  A as maxValue,
  D as literal,
  H as picklist,
  I as number,
  J as safeInteger,
  K as record,
  L as object,
  M as minValue,
  Q as string,
  U as pipe,
  Z as strictObject,
  f as uuidV7Schema,
  it as url,
  j as minLength,
  k as maxLength,
  q as regex,
} from "./react-dom-BCYT53bd.js";
//#region ../../packages/utils/src/crypto.ts
async function sha256(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
//#endregion
//#region ../../packages/assets/src/schemas/policy.ts
var MAX_IMPORT_BYTES = 10485760;
var assetPolicy = {
  catalogue_import: {
    bucket: "imports",
    visibility: "private",
    directUpload: true,
  },
  sync_snapshot: {
    bucket: "snapshots",
    visibility: "private",
    directUpload: false,
  },
};
var importContentType = picklist([
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/vnd.ms-excel",
]);
var importUploadInput = strictObject({
  fileName: pipe(
    string(),
    minLength(1),
    maxLength(255),
    regex(/^[^/\\\x00-\x1f]+\.(csv|xlsx|xls)$/i),
  ),
  contentType: importContentType,
  sizeBytes: pipe(number(), safeInteger(), minValue(1), maxValue(MAX_IMPORT_BYTES)),
  sha256: pipe(string(), regex(/^[a-f0-9]{64}$/)),
});
var assetReference = strictObject({ assetId: uuidV7Schema });
var importUploadGrant = object({
  assetId: uuidV7Schema,
  url: pipe(string(), url()),
  method: literal("PUT"),
  headers: record(string(), string()),
  expiresAt: pipe(number(), safeInteger()),
});
//#endregion
export {
  importUploadGrant as a,
  importContentType as i,
  assetPolicy as n,
  importUploadInput as o,
  assetReference as r,
  sha256 as s,
  MAX_IMPORT_BYTES as t,
};
