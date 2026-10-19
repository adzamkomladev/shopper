import { and, eq, inArray } from "drizzle-orm";
import * as v from "valibot";
import { product, sale, type ShopperDatabase } from "@shopper/db-pg";
import { saleSnapshot } from "../schemas/till/sale";
import type { UploadPrincipal } from "../sales/types";
import { cashRefunded, refundedQuantities } from "./validate";

/** A sale of this store by receipt number, from any register, with what has been refunded and which products are final sale. */
export async function lookupSale(db: ShopperDatabase, principal: UploadPrincipal, receipt: string) {
  const [found] = await db
    .select()
    .from(sale)
    .where(
      and(
        eq(sale.orgId, principal.orgId),
        eq(sale.storeId, principal.storeId),
        eq(sale.receiptNumber, receipt),
      ),
    );
  if (!found) return undefined;
  const snapshot = v.parse(saleSnapshot, found.payload);
  const refunded = await refundedQuantities(
    db,
    principal.orgId,
    snapshot.lines.map((line) => line.id),
  );
  const flags = await db
    .select({ id: product.id, finalSale: product.finalSale })
    .from(product)
    .where(
      and(
        eq(product.orgId, principal.orgId),
        inArray(
          product.id,
          snapshot.lines.map((line) => line.productId),
        ),
      ),
    );
  return {
    sale: snapshot,
    occurredAt: found.occurredAt.toISOString(),
    receipt: found.receipt,
    refunded: Object.fromEntries(refunded),
    cashRefunded: await cashRefunded(db, principal.orgId, found.id),
    finalSale: Object.fromEntries(flags.map((row) => [row.id, row.finalSale])),
  };
}
