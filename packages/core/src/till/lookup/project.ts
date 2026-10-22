import { eq, sql } from "drizzle-orm";
import { customerLookup, type TillSqlite } from "@shopper/db-sqlite";
import type { ProjectedProduct } from "./types";

const CHUNK = 500;

/** Replaces the lookup rows, barcodes and FTS entries of these products; archived ones are only removed. */
export async function projectProducts(tx: TillSqlite, orgId: string, products: ProjectedProduct[]) {
  for (let from = 0; from < products.length; from += CHUNK) {
    const chunk = products.slice(from, from + CHUNK);
    const all = JSON.stringify(chunk.map((p) => p.id));
    const live = JSON.stringify(
      chunk
        .filter((p) => !p.archivedAt)
        .map((p) => ({ id: p.id, sku: p.sku, name: p.name, barcodes: p.barcodes })),
    );
    const owned = sql`org_id = ${orgId} AND product_id IN (SELECT value FROM json_each(${all}))`;
    await tx.run(
      sql`DELETE FROM product_search WHERE rowid IN (SELECT rowid FROM product_lookup WHERE ${owned})`,
    );
    await tx.run(sql`DELETE FROM product_barcode WHERE ${owned}`);
    await tx.run(sql`DELETE FROM product_lookup WHERE ${owned}`);
    await tx.run(
      sql`INSERT INTO product_lookup(org_id, product_id, sku, name)
        SELECT ${orgId}, json_extract(value, '$.id'), json_extract(value, '$.sku'), json_extract(value, '$.name')
        FROM json_each(${live})`,
    );
    await tx.run(
      sql`INSERT INTO product_search(rowid, name)
        SELECT rowid, name FROM product_lookup
        WHERE org_id = ${orgId} AND product_id IN (SELECT json_extract(value, '$.id') FROM json_each(${live}))`,
    );
    await tx.run(
      sql`INSERT OR REPLACE INTO product_barcode(org_id, code, product_id, quantity_thousandths)
        SELECT ${orgId}, json_extract(b.value, '$.code'), json_extract(p.value, '$.id'),
          json_extract(b.value, '$.quantityThousandths')
        FROM json_each(${live}) p, json_each(p.value, '$.barcodes') b`,
    );
  }
}

/** Removes the products with these ids from the lookup. */
export async function unprojectProducts(tx: TillSqlite, orgId: string, ids: string[]) {
  await projectProducts(
    tx,
    orgId,
    ids.map((id) => ({ id, sku: "", name: "", archivedAt: "removed", barcodes: [] })),
  );
}

/** Clears one organisation's lookup, as a snapshot rebuild starts. */
export async function clearProjection(tx: TillSqlite, orgId: string) {
  await tx.run(
    sql`DELETE FROM product_search WHERE rowid IN (SELECT rowid FROM product_lookup WHERE org_id = ${orgId})`,
  );
  await tx.run(sql`DELETE FROM product_barcode WHERE org_id = ${orgId}`);
  await tx.run(sql`DELETE FROM product_lookup WHERE org_id = ${orgId}`);
  await tx.delete(customerLookup).where(eq(customerLookup.orgId, orgId));
}
