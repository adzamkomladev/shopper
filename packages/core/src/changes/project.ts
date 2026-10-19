import type { BaseUnit, price, taxRule } from "@shopper/db-pg";
import type { Change } from "./record";
import { mappingView } from "../catalogue/mappings/queries";
import type { ProductBarcode } from "./types";

type Product = {
  id: string;
  sku: string;
  name: string;
  baseUnit: BaseUnit;
  taxClass: string;
  finalSale: boolean;
  archivedAt: Date | string | null;
  barcodes: ProductBarcode[];
};
const iso = (value: Date | string) => new Date(value).toISOString();

/** Till-shaped rows (see schemas/till/reference.ts), field by field: a new column never reaches a till by accident. */
export function productUpsert(orgId: string, row: Product): Change {
  return {
    entity: "product",
    entityId: row.id,
    op: "upsert",
    payload: {
      id: row.id,
      orgId,
      sku: row.sku,
      name: row.name,
      baseUnit: row.baseUnit,
      taxClass: row.taxClass,
      finalSale: row.finalSale,
      archivedAt: row.archivedAt ? iso(row.archivedAt) : null,
      barcodes: row.barcodes,
    },
  };
}

export function priceUpsert(row: typeof price.$inferSelect): Change {
  return {
    entity: "price",
    entityId: row.id,
    op: "upsert",
    payload: {
      id: row.id,
      orgId: row.orgId,
      productId: row.productId,
      branchId: row.branchId,
      amount: row.amount,
      validFrom: iso(row.validFrom),
      validTo: row.validTo ? iso(row.validTo) : null,
    },
  };
}

export function taxRuleUpsert(row: typeof taxRule.$inferSelect): Change {
  return {
    entity: "tax-rule",
    entityId: row.id,
    op: "upsert",
    payload: {
      id: row.id,
      orgId: row.orgId,
      effectiveFrom: row.effectiveFrom,
      vatBps: row.vatBps,
      nhilBps: row.nhilBps,
      getfundBps: row.getfundBps,
      covidBps: row.covidBps,
      source: row.source,
    },
  };
}

export const mappingUpsert = (row: ReturnType<typeof mappingView>): Change => ({
  entity: "barcode-mapping",
  entityId: row.id,
  op: "upsert",
  payload: row,
});

export const deleted = (entity: Change["entity"], id: string): Change => ({
  entity,
  entityId: id,
  op: "delete",
  payload: { id },
});
