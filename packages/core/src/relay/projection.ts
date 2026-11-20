import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  asset,
  branch,
  org,
  branchFulfilment,
  category,
  price,
  product,
  store,
  taxClass,
} from "@shopper/db-pg";
import type { Queryable } from "../types";
import { relayAvailability } from "./availability";

/**
 * The online catalogue a box publishes to its relay org (v1.5), field by field: nothing else about the shop (costs,
 * suppliers, movements, customers) can leave by accident; stock only as each branch's floored availability. Products are those visible online and not archived; prices are
 * theirs that are still in force or start later. The relay's copy read with the same function must equal the box's.
 */
export async function relayProjection(db: Queryable, orgId: string, now = new Date()) {
  const shop = await db
    .select({
      id: org.id,
      tin: org.tin,
      vatRegisteredFrom: org.vatRegisteredFrom,
      priceMode: org.priceMode,
    })
    .from(org)
    .where(eq(org.id, orgId));
  const stores = await db
    .select({ id: store.id, name: store.name })
    .from(store)
    .where(eq(store.orgId, orgId))
    .orderBy(asc(store.id));
  const branches = await db
    .select({ id: branch.id, storeId: branch.storeId, name: branch.name })
    .from(branch)
    .where(eq(branch.orgId, orgId))
    .orderBy(asc(branch.id));
  const fulfilment = await db
    .select({
      id: branchFulfilment.id,
      branchId: branchFulfilment.branchId,
      pickup: branchFulfilment.pickup,
      delivery: branchFulfilment.delivery,
      deliveryFee: branchFulfilment.deliveryFee,
      opens: branchFulfilment.opens,
      closes: branchFulfilment.closes,
      slotMinutes: branchFulfilment.slotMinutes,
      slotCapacity: branchFulfilment.slotCapacity,
      leadMinutes: branchFulfilment.leadMinutes,
    })
    .from(branchFulfilment)
    .where(eq(branchFulfilment.orgId, orgId))
    .orderBy(asc(branchFulfilment.id));
  const categories = await db
    .select({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      onlineVisible: category.onlineVisible,
    })
    .from(category)
    .where(eq(category.orgId, orgId))
    // Departments first: a category's parent must already be on the relay.
    .orderBy(sql`${category.parentId} IS NOT NULL`, asc(category.id));
  const products = await db
    .select(productFields)
    .from(product)
    .innerJoin(
      taxClass,
      and(eq(taxClass.orgId, product.orgId), eq(taxClass.id, product.taxClassId)),
    )
    .leftJoin(asset, and(eq(asset.orgId, product.orgId), eq(asset.id, product.imageAssetId)))
    .where(
      and(eq(product.orgId, orgId), eq(product.onlineVisible, true), isNull(product.archivedAt)),
    )
    .orderBy(asc(product.id));
  const prices = await db
    .select({
      id: price.id,
      productId: price.productId,
      branchId: price.branchId,
      amount: price.amount,
      validFrom: price.validFrom,
      validTo: price.validTo,
    })
    .from(price)
    .innerJoin(product, and(eq(product.orgId, price.orgId), eq(product.id, price.productId)))
    .where(
      and(
        eq(price.orgId, orgId),
        eq(product.onlineVisible, true),
        isNull(product.archivedAt),
        sql`(${price.validTo} IS NULL OR ${price.validTo} > ${now})`,
        // An open-ended price replaced by a later one already in force is history; the store never shows it.
        sql`NOT (${price.validTo} IS NULL AND EXISTS (
          SELECT 1 FROM price q WHERE q.org_id = ${price.orgId} AND q.product_id = ${price.productId}
            AND q.branch_id IS NOT DISTINCT FROM ${price.branchId} AND q.valid_to IS NULL
            AND q.valid_from <= ${now} AND (q.valid_from, q.id) > (${price.validFrom}, ${price.id})))`,
      ),
    )
    .orderBy(asc(price.id));
  return {
    shop,
    stores,
    branches,
    // PostgreSQL reads a time as HH:MM:SS; the wire and the back office use HH:MM.
    fulfilment: fulfilment.map((row) => ({
      ...row,
      deliveryFee: Number(row.deliveryFee),
      opens: row.opens.slice(0, 5),
      closes: row.closes.slice(0, 5),
    })),
    categories,
    products,
    prices: prices.map((row) => ({
      ...row,
      amount: Number(row.amount),
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
    })),
    availability: await relayAvailability(db, orgId, now),
  };
}

/** A product as the relay holds it; the Publisher also reads a hidden or archived one through it to withdraw it. */
export const productFields = {
  id: product.id,
  sku: product.sku,
  name: product.name,
  categoryId: product.categoryId,
  taxClass: taxClass.code,
  baseUnit: product.baseUnit,
  onlineVisible: sql<boolean>`${product.onlineVisible} AND ${product.archivedAt} IS NULL`,
  /** The photo's digest: the relay holds it content-addressed, so equal digests mean equal photos. */
  image: asset.sha256,
};
