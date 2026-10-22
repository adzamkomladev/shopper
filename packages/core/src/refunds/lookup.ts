import { and, eq, inArray, sql } from "drizzle-orm";
import * as v from "valibot";
import { product, refund, sale, type ShopperDatabase } from "@shopper/db-pg";
import { fromBigInt } from "@shopper/money";
import { saleSnapshot } from "../schemas/till/sale";
import type { UploadPrincipal } from "../sales/types";
import { refundedQuantities } from "./validate";

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
    ...(await refundedMoney(db, principal.orgId, found.id)),
    finalSale: Object.fromEntries(flags.map((row) => [row.id, row.finalSale])),
  };
}

/**
 * Gross already paid back in cash for a sale (the till rounds the next cash payout on top of it), what its refunds
 * credited to the customer's account and the redeemed points they handed back.
 */
async function refundedMoney(db: ShopperDatabase, orgId: string, saleId: string) {
  const [prior] = await db
    .select({
      cash: sql<string>`COALESCE(SUM(${refund.total} - ${refund.cashRounding}) FILTER (WHERE ${refund.tenderKind} = 'cash'), 0)::text`,
      account: sql<string>`COALESCE(SUM(${refund.accountCredit}), 0)::text`,
      points: sql<string>`COALESCE(SUM(${refund.pointsReturned}), 0)::text`,
    })
    .from(refund)
    .where(and(eq(refund.orgId, orgId), eq(refund.originalSaleId, saleId)));
  return {
    cashRefunded: fromBigInt(BigInt(prior?.cash ?? "0")),
    accountCredited: fromBigInt(BigInt(prior?.account ?? "0")),
    pointsReturned: Number(prior?.points ?? 0),
  };
}
