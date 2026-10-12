import * as v from "valibot";
import { and, asc, desc, eq, ilike, lt, isNull, or, sql, type SQL } from "drizzle-orm";
import type { SelectedFields } from "drizzle-orm/pg-core";
import { price, product, productBarcode, taxClass } from "@shopper/db-pg";
import { managementJson } from "../management";
import { uuidV7Schema } from "@shopper/ports";
import { priceAt, priceView } from "./prices";
import { listQuery, lookupQuery } from "../schemas/catalogue";
import type { Queryable } from "../types";

const columns = {
  id: product.id,
  sku: product.sku,
  name: product.name,
  baseUnit: product.baseUnit,
  taxClass: taxClass.code,
  categoryId: product.categoryId,
  supplierId: product.supplierId,
  onlineVisible: product.onlineVisible,
  archivedAt: product.archivedAt,
};
const selectProducts = <T extends SelectedFields = typeof columns>(db: Queryable, shape?: T) =>
  db
    .select((shape ?? columns) as T)
    .from(product)
    .innerJoin(
      taxClass,
      and(eq(taxClass.orgId, product.orgId), eq(taxClass.id, product.taxClassId)),
    );

/** The product as the API shows it; `lock` takes a row lock for the before snapshot. */
export async function loadProduct(db: Queryable, orgId: string, id: string, lock = false) {
  const query = selectProducts(db).where(and(eq(product.orgId, orgId), eq(product.id, id)));
  const [row] = await (lock ? query.for("update", { of: product }) : query);
  return row ? managementJson(row) : null;
}

export async function getProduct(db: Queryable, orgId: string, id: string) {
  if (!v.is(uuidV7Schema, id)) return null;
  const row = await loadProduct(db, orgId, id);
  if (!row) return null;
  // Sequential: one pg client runs one query at a time.
  const barcodes = await db
    .select({
      code: productBarcode.code,
      quantityThousandths: productBarcode.quantityThousandths,
    })
    .from(productBarcode)
    .where(and(eq(productBarcode.orgId, orgId), eq(productBarcode.productId, id)))
    .orderBy(asc(productBarcode.code));
  const prices = await db
    .select()
    .from(price)
    .where(and(eq(price.orgId, orgId), eq(price.productId, id)))
    .orderBy(desc(price.validFrom), desc(price.id));
  return { ...row, barcodes, prices: prices.map(priceView) };
}

/** Active products, newest first, keyset-paged by id. `q` matches a name fragment, an exact sku or an exact barcode. */
export async function listProducts(db: Queryable, orgId: string, rawQuery: unknown) {
  const { q, categoryId, cursor, limit } = v.parse(listQuery, rawQuery);
  const filters: (SQL | undefined)[] = [
    eq(product.orgId, orgId),
    isNull(product.archivedAt),
    categoryId ? eq(product.categoryId, categoryId) : undefined,
    cursor ? lt(product.id, cursor) : undefined,
    q
      ? or(
          ilike(product.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`),
          eq(product.sku, q),
          sql`exists (select 1 from ${productBarcode} where ${productBarcode.orgId} = ${product.orgId} and ${productBarcode.productId} = ${product.id} and ${productBarcode.code} = ${q})`,
        )
      : undefined,
  ];
  // The org-wide price in force now, by the priceAt rule with branch_id null only.
  const current = sql<number | null>`(
    select ${price.amount} from ${price}
    where ${price.orgId} = ${product.orgId} and ${price.productId} = ${product.id}
      and ${price.branchId} is null and ${price.validFrom} <= now()
      and (${price.validTo} is null or ${price.validTo} > now())
    order by ${price.validFrom} desc, ${price.id} desc limit 1)`.mapWith((value) =>
    value === null ? null : Number(value),
  );
  const rows = await selectProducts(db, { ...columns, price: current })
    .where(and(...filters))
    .orderBy(desc(product.id))
    .limit(limit + 1);
  const items = managementJson(rows.slice(0, limit));
  return { items, nextCursor: rows.length > limit ? items[limit - 1]!.id : null };
}

/** A scan: the active product behind a barcode, its pack quantity and the price in force. */
export async function findByBarcode(db: Queryable, orgId: string, code: string, rawQuery: unknown) {
  const { branchId, at } = v.parse(lookupQuery, rawQuery);
  const [row] = await db
    .select({ ...columns, quantityThousandths: productBarcode.quantityThousandths })
    .from(productBarcode)
    .innerJoin(
      product,
      and(eq(product.orgId, productBarcode.orgId), eq(product.id, productBarcode.productId)),
    )
    .innerJoin(
      taxClass,
      and(eq(taxClass.orgId, product.orgId), eq(taxClass.id, product.taxClassId)),
    )
    .where(
      and(
        eq(productBarcode.orgId, orgId),
        eq(productBarcode.code, code),
        isNull(product.archivedAt),
      ),
    );
  if (!row) return null;
  const { quantityThousandths, ...found } = row;
  const current = await priceAt(db, { orgId, productId: row.id, branchId, at });
  return managementJson({
    product: found,
    quantityThousandths,
    price: current && priceView(current),
  });
}
