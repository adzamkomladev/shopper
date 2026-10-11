import { and, desc, eq, inArray, isNull, lte, gt, or } from "drizzle-orm";
import { price, product, productBarcode } from "@shopper/db-pg";
import type { Money } from "@shopper/money";
import type { Queryable } from "../../types";
import type { Headers } from "./parse";
import { categoryOf, chunks, loadRefs, supplierOf, type Refs } from "./refs";
import type { CleanRow, ImportError } from "./validate";

export type Planned = {
  row: CleanRow;
  existingId?: string;
  newBarcodes: CleanRow["barcodes"];
  quantityFixes: CleanRow["barcodes"];
  fieldsChanged: boolean;
  priceNeeded: boolean;
};
/** Read-only: what importing these rows would do. Dry runs stop here; the command then writes it. */
export async function planImport(
  db: Queryable,
  orgId: string,
  rows: CleanRow[],
  headers: Headers,
  at: Date,
) {
  const refs = await loadRefs(db, orgId);
  const existing = await existingProducts(db, orgId, rows);
  const owners = await barcodeOwners(db, orgId, rows);
  const errors: ImportError[] = [];
  const kept: CleanRow[] = [];
  for (const row of rows) {
    if (!row.taxClass && !existing.has(row.sku)) {
      errors.push({
        row: row.row,
        column: "Tax Class",
        value: "",
        message: "New products need a Tax Class column (Standard, Zero-rated or Exempt)",
      });
      continue;
    }
    if (row.taxClass && !refs.tax.has(row.taxClass)) {
      errors.push({
        row: row.row,
        column: headers.taxClass ?? "taxClass",
        value: row.taxClass,
        message: `This organisation has no ${row.taxClass} tax class`,
      });
      continue;
    }
    const mine = existing.get(row.sku)?.id;
    const clash = row.barcodes.find(
      (b) => owners.has(b.code) && owners.get(b.code)!.productId !== mine,
    );
    if (!clash) kept.push(row);
    else
      errors.push({
        row: row.row,
        column: headers[clash.column] ?? clash.column,
        value: clash.code,
        message: `Barcode ${clash.code} already belongs to another product`,
      });
  }
  const current = await currentPrices(
    db,
    orgId,
    [...existing.values()].map((p) => p.id),
    at,
  );
  const planned = kept.map((row): Planned => {
    const found = existing.get(row.sku);
    const have = (code: string) => owners.get(code);
    return {
      row,
      existingId: found?.id,
      newBarcodes: row.barcodes.filter((b) => !have(b.code)),
      quantityFixes: row.barcodes.filter(
        (b) => have(b.code) && have(b.code)!.quantityThousandths !== b.quantityThousandths,
      ),
      fieldsChanged: !!found && differs(found, row, refs, fieldSet(headers, false)),
      priceNeeded: !found || current.get(found.id) !== row.amount,
    };
  });
  const created = planned.filter((p) => !p.existingId).length;
  const updated = planned.filter((p) => p.existingId && isChanged(p)).length;
  return {
    planned,
    errors,
    counts: {
      created,
      updated,
      unchanged: planned.length - created - updated,
      pricesAdded: planned.filter((p) => p.priceNeeded).length,
    },
  };
}

const isChanged = (p: Planned) =>
  p.fieldsChanged || !!p.newBarcodes.length || !!p.quantityFixes.length;

type Existing = typeof product.$inferSelect;
function differs(found: Existing, row: CleanRow, refs: Refs, use: FieldSet) {
  return (
    found.name !== row.name ||
    (use.unit && found.baseUnit !== row.baseUnit) ||
    (use.online && found.onlineVisible !== row.onlineVisible) ||
    (use.tax && !!row.taxClass && found.taxClassId !== refs.tax.get(row.taxClass)) ||
    (use.category && found.categoryId !== categoryOf(refs, row)) ||
    (use.supplier && found.supplierId !== supplierOf(refs, row))
  );
}

/** Which optional fields an import writes: a column the file lacks leaves an existing product alone. */
export type FieldSet = Record<"unit" | "online" | "tax" | "category" | "supplier", boolean>;
export const fieldSet = (headers: Headers, isNew: boolean): FieldSet => ({
  unit: isNew || !!headers.unit,
  online: isNew || !!headers.online,
  tax: isNew || !!headers.taxClass,
  category: isNew || !!headers.department || !!headers.category,
  supplier: isNew || !!headers.supplier,
});

async function existingProducts(db: Queryable, orgId: string, rows: CleanRow[]) {
  const found = new Map<string, Existing>();
  for (const part of chunks(rows.map((r) => r.sku)))
    for (const p of await db
      .select()
      .from(product)
      .where(and(eq(product.orgId, orgId), inArray(product.sku, part))))
      found.set(p.sku, p);
  return found;
}

async function barcodeOwners(db: Queryable, orgId: string, rows: CleanRow[]) {
  const owners = new Map<string, { productId: string; quantityThousandths: number }>();
  for (const part of chunks(rows.flatMap((r) => r.barcodes.map((b) => b.code))))
    for (const b of await db
      .select()
      .from(productBarcode)
      .where(and(eq(productBarcode.orgId, orgId), inArray(productBarcode.code, part))))
      owners.set(b.code, b);
  return owners;
}

/** The org-wide price in force at `at` per product, ordered exactly as priceAt orders it. */
async function currentPrices(db: Queryable, orgId: string, ids: string[], at: Date) {
  const current = new Map<string, Money>();
  for (const part of chunks(ids))
    for (const p of await db
      .selectDistinctOn([price.productId], { productId: price.productId, amount: price.amount })
      .from(price)
      .where(
        and(
          eq(price.orgId, orgId),
          inArray(price.productId, part),
          isNull(price.branchId),
          lte(price.validFrom, at),
          or(isNull(price.validTo), gt(price.validTo, at)),
        ),
      )
      .orderBy(price.productId, desc(price.validFrom), desc(price.id)))
      current.set(p.productId, p.amount);
  return current;
}
