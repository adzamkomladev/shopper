import {
  B as parse,
  H as picklist,
  L as object,
  Q as string,
  U as pipe,
  X as setSpecificMessage,
  j as minLength,
  k as maxLength,
  tt as trim,
} from "./react-dom-BCYT53bd.js";
import { c as productInput } from "./inputs-CH80xucg.js";
import { n as ApiError } from "./createLucideIcon-DmKyVZgg.js";
import "./schemas-B4d_8FW9.js";
//#region ../../packages/backoffice/src/schemas/catalogue.ts
setSpecificMessage(minLength, "Required");
setSpecificMessage(maxLength, (issue) => `Use ${issue.requirement} characters or fewer`);
setSpecificMessage(picklist, "Choose an option");
var { name, sku, baseUnit, taxClass, categoryId } = productInput.entries;
/** The sheet's fields. The API takes a barcode list; the sheet offers one optional barcode. */
var newProductSchema = object({
  name,
  sku,
  baseUnit,
  taxClass,
  categoryId,
  barcode: pipe(string(), trim(), maxLength(64)),
});
var FIELDS = ["name", "sku", "baseUnit", "taxClass", "categoryId", "barcode"];
var emptyProduct = {
  name: "",
  sku: "",
  baseUnit: "each",
  taxClass: "standard",
  categoryId: null,
  barcode: "",
};
function toProductBody({ barcode, ...values }) {
  return parse(productInput, {
    ...values,
    barcodes: barcode ? [{ code: barcode }] : [],
  });
}
/** What to tell the owner; the API says only "Already exists" for a duplicate SKU or barcode. */
function messageOfError(error) {
  return error instanceof ApiError && error.status === 409
    ? "Another product already uses this"
    : error.message;
}
/** The sheet field an API error belongs to ("barcodes.0.code" is the Barcode field), if any. */
function fieldOfError(error) {
  if (!(error instanceof ApiError) || !error.field) return void 0;
  const field = error.field.startsWith("barcodes") ? "barcode" : error.field;
  return FIELDS.find((name) => name === field);
}
//#endregion
export {
  toProductBody as a,
  newProductSchema as i,
  fieldOfError as n,
  messageOfError as r,
  emptyProduct as t,
};
