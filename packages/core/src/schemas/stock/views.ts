import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { stockDocumentKinds } from "@shopper/db-pg";
import { listQuery } from "../catalogue/inputs";

const id = uuidV7Schema;
const int = v.pipe(v.number(), v.safeInteger());
const page = <E extends v.GenericSchema>(item: E) =>
  v.object({ items: v.array(item), nextCursor: v.nullable(id) });

/** Query strings of the stock reads; `branchId` is forced to the till's own for device principals. */
export const stockQuery = v.object({
  ...listQuery.entries,
  branchId: id,
  low: v.optional(v.literal("1")),
});
export const productStockQuery = v.object({ branchId: id });
export const documentsQuery = v.object({
  branchId: v.optional(id),
  kind: v.optional(v.picklist(stockDocumentKinds)),
  cursor: v.optional(id),
  limit: listQuery.entries.limit,
});

export const stockBranchList = v.object({
  branches: v.array(v.object({ id, name: v.string() })),
});

export const stockItem = v.object({
  productId: id,
  sku: v.string(),
  name: v.string(),
  baseUnit: v.string(),
  categoryId: v.nullable(id),
  onHandThousandths: int,
  levelThousandths: v.nullable(int),
  low: v.boolean(),
});
export const stockList = page(stockItem);

export const stockMovementView = v.object({
  id,
  reason: v.string(),
  quantityThousandths: int,
  balanceThousandths: int,
  unitCost: v.nullable(int),
  documentId: v.nullable(id),
  saleId: v.nullable(id),
  refundId: v.nullable(id),
  occurredAt: v.string(),
});
export const stockProductView = v.object({
  ...stockItem.entries,
  movements: v.array(stockMovementView),
});

export const documentSummary = v.object({
  id,
  kind: v.picklist(stockDocumentKinds),
  branchId: id,
  branchName: v.string(),
  supplierId: v.nullable(id),
  supplierName: v.nullable(v.string()),
  cause: v.nullable(v.string()),
  actorName: v.string(),
  lineCount: int,
  occurredAt: v.string(),
});
export const documentList = page(documentSummary);
export const documentDetail = v.object({
  ...documentSummary.entries,
  lines: v.array(
    v.object({
      productId: id,
      sku: v.string(),
      name: v.string(),
      quantityThousandths: int,
      unitCost: v.nullable(int),
    }),
  ),
});

export const stockValuationView = v.object({
  lines: v.array(
    v.object({
      productId: id,
      sku: v.string(),
      name: v.string(),
      onHandThousandths: int,
      unitCost: v.nullable(int),
      value: int,
      flag: v.nullable(v.picklist(["no_cost", "negative"])),
    }),
  ),
  total: int,
});
