// What the catalogue API sends: ISO date strings and integer money, never Date or bigint.
import * as v from "valibot";

const id = v.string();
const iso = v.string();
const money = v.pipe(v.number(), v.safeInteger());
const count = v.pipe(v.number(), v.safeInteger());

export const orgSummary = v.object({ id, name: v.string() });

export const priceView = v.object({
  id,
  branchId: v.nullable(id),
  amount: money,
  validFrom: iso,
  validTo: v.nullable(iso),
});

const productFields = {
  id,
  sku: v.string(),
  name: v.string(),
  baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
  taxClass: v.picklist(["standard", "zero-rated", "exempt"]),
  categoryId: v.nullable(id),
  supplierId: v.nullable(id),
  onlineVisible: v.boolean(),
  archivedAt: v.nullable(iso),
};
export const productSummary = v.object({ ...productFields, price: v.nullable(money) });
export const productPage = v.object({
  items: v.array(productSummary),
  nextCursor: v.nullable(id),
});
export const productDetail = v.object({
  ...productFields,
  barcodes: v.array(v.object({ code: v.string(), quantityThousandths: count })),
  prices: v.array(priceView),
});

export const categoryView = v.object({
  id,
  name: v.string(),
  parentId: v.nullable(id),
  createdAt: iso,
  updatedAt: iso,
});
export const supplierView = v.object({
  id,
  name: v.string(),
  phone: v.nullable(v.string()),
  email: v.nullable(v.string()),
  tin: v.nullable(v.string()),
  createdAt: iso,
  updatedAt: iso,
});

const importError = v.object({
  row: count,
  column: v.string(),
  value: v.string(),
  message: v.string(),
});
const importCounts = {
  rowsTotal: count,
  rowsOk: count,
  rowsFailed: count,
  errors: v.array(importError),
};
export const importPreview = v.object({
  dryRun: v.literal(true),
  ...importCounts,
  created: count,
  updated: count,
  unchanged: count,
  pricesAdded: count,
});
export const importRecord = v.object({
  id,
  fileName: v.string(),
  rowsTotal: count,
  rowsOk: count,
  rowsFailed: count,
  report: v.object({ errors: v.array(importError) }),
  priceValidFrom: iso,
  createdAt: iso,
});
