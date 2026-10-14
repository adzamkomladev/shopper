import { and, asc, eq, inArray } from "drizzle-orm";
import { productBarcode } from "@shopper/db-pg";
import type { Queryable } from "../types";
import type { ProductBarcode } from "./types";

/** Every product's barcodes by product id, chunked under the bind limit; ids without any map to []. */
export async function loadBarcodes(db: Queryable, orgId: string, ids: string[]) {
  const byProduct = new Map<string, ProductBarcode[]>(ids.map((id) => [id, []]));
  for (let at = 0; at < ids.length; at += 5000)
    for (const row of await db
      .select()
      .from(productBarcode)
      .where(
        and(
          eq(productBarcode.orgId, orgId),
          inArray(productBarcode.productId, ids.slice(at, at + 5000)),
        ),
      )
      .orderBy(asc(productBarcode.code)))
      byProduct.get(row.productId)!.push({
        code: row.code,
        quantityThousandths: row.quantityThousandths,
      });
  return byProduct;
}
