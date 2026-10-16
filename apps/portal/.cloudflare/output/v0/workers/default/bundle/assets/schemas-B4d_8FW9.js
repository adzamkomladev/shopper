import {
  D as literal,
  F as nullable,
  H as picklist,
  I as number,
  J as safeInteger,
  L as object,
  Q as string,
  U as pipe,
  h as boolean,
  m as array,
} from "./react-dom-BCYT53bd.js";
import "./inputs-CH80xucg.js";
//#region ../../packages/core/src/schemas/catalogue/views.ts
var id = string();
var iso = string();
var money = pipe(number(), safeInteger());
var count = pipe(number(), safeInteger());
var orgSummary = object({
  id,
  name: string(),
});
var branchView = object({
  id,
  name: string(),
  storeId: id,
});
var priceView = object({
  id,
  branchId: nullable(id),
  amount: money,
  validFrom: iso,
  validTo: nullable(iso),
  reason: nullable(string()),
});
var productFields = {
  id,
  sku: string(),
  name: string(),
  baseUnit: picklist(["each", "kg", "g", "l", "ml"]),
  taxClass: picklist(["standard", "zero-rated", "exempt"]),
  categoryId: nullable(id),
  supplierId: nullable(id),
  onlineVisible: boolean(),
  archivedAt: nullable(iso),
};
var productSummary = object({
  ...productFields,
  price: nullable(money),
});
var productPage = object({
  items: array(productSummary),
  nextCursor: nullable(id),
});
var productDetail = object({
  ...productFields,
  barcodes: array(
    object({
      code: string(),
      quantityThousandths: count,
    }),
  ),
  prices: array(priceView),
});
var categoryView = object({
  id,
  name: string(),
  parentId: nullable(id),
  createdAt: iso,
  updatedAt: iso,
});
object({
  id,
  name: string(),
  phone: nullable(string()),
  email: nullable(string()),
  tin: nullable(string()),
  createdAt: iso,
  updatedAt: iso,
});
var importError = object({
  row: count,
  column: string(),
  value: string(),
  message: string(),
});
var importCounts = {
  rowsTotal: count,
  rowsOk: count,
  rowsFailed: count,
  errors: array(importError),
};
var importPreview = object({
  dryRun: literal(true),
  ...importCounts,
  created: count,
  updated: count,
  unchanged: count,
  pricesAdded: count,
});
var importResult = object({
  dryRun: literal(false),
  id,
  ...importCounts,
  created: count,
  updated: count,
  unchanged: count,
  pricesAdded: count,
});
object({
  id,
  fileName: string(),
  rowsTotal: count,
  rowsOk: count,
  rowsFailed: count,
  report: object({ errors: array(importError) }),
  priceValidFrom: iso,
  createdAt: iso,
});
//#endregion
export {
  orgSummary as a,
  productPage as c,
  importResult as i,
  categoryView as n,
  priceView as o,
  importPreview as r,
  productDetail as s,
  branchView as t,
};
