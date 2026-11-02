import * as v from "valibot";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { branch, cataloguePublic, category, price } from "@shopper/db-pg";
import {
  STORE_PAGE_SIZE,
  storeProductQuery,
  storeId,
  storeProductsQuery,
} from "../schemas/storefront/query";
import { onHandOf } from "../stock/onhand";
import type { Queryable } from "../types";
import { StoreError } from "./error";

/**
 * The online store's only view of the catalogue: products the shop marked visible online (`catalogue_public`),
 * priced as the till prices them at the same moment (a branch's own price beats the shop's, the latest start wins)
 * and in stock at the branch. A product without a price or stock there is not listed, and its page says so.
 */
export async function listStoreProducts(
  db: Queryable,
  orgId: string,
  raw: unknown,
  now = new Date(),
) {
  const query = v.parse(storeProductsQuery, raw);
  const site = await storeBranch(db, orgId, query.branch);
  const amount = priceIn(orgId, site.id, now);
  const where = and(
    eq(cataloguePublic.orgId, orgId),
    sql`${amount} IS NOT NULL`,
    sql`${onHandOf(orgId, site.id, listed)} > 0`,
    query.category ? eq(cataloguePublic.categoryId, query.category) : undefined,
    query.q
      ? or(
          ilike(cataloguePublic.name, `%${escape(query.q)}%`),
          ilike(cataloguePublic.sku, `%${escape(query.q)}%`),
        )
      : undefined,
  );
  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cataloguePublic)
    .where(where);
  const rows = await db
    .select({ ...productFields, price: amount })
    .from(cataloguePublic)
    .where(where)
    .orderBy(asc(cataloguePublic.name), asc(cataloguePublic.productId))
    .limit(STORE_PAGE_SIZE)
    .offset((query.page - 1) * STORE_PAGE_SIZE);
  const total = counted?.total ?? 0;
  return {
    branch: site,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / STORE_PAGE_SIZE)),
    total,
    products: rows.map((row) => ({ ...row, price: Number(row.price) })),
  };
}

/** One visible product at a branch: its price and stock there, or `available: false` when it cannot be bought. */
export async function readStoreProduct(
  db: Queryable,
  orgId: string,
  productId: string,
  raw: unknown,
  now = new Date(),
) {
  const query = v.parse(storeProductQuery, raw);
  const site = await storeBranch(db, orgId, query.branch);
  if (!v.is(storeId, productId)) return null;
  const [row] = await db
    .select({
      ...productFields,
      price: priceIn(orgId, site.id, now),
      onHand: onHandOf(orgId, site.id, listed),
      categoryName: category.name,
    })
    .from(cataloguePublic)
    .leftJoin(
      category,
      and(eq(category.orgId, cataloguePublic.orgId), eq(category.id, cataloguePublic.categoryId)),
    )
    .where(and(eq(cataloguePublic.orgId, orgId), eq(cataloguePublic.productId, productId)));
  if (!row) return null;
  const amount = row.price === null ? null : Number(row.price);
  return {
    branch: site,
    product: {
      id: row.id,
      sku: row.sku,
      name: row.name,
      baseUnit: row.baseUnit,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      imageAssetId: row.imageAssetId,
      price: amount,
      available: amount !== null && row.onHand > 0,
    },
  };
}

/** The shop's branches, for the store's branch picker; the first is the default. */
export async function listStoreBranches(db: Queryable, orgId: string) {
  return db
    .select({ id: branch.id, name: branch.name })
    .from(branch)
    .where(eq(branch.orgId, orgId))
    .orderBy(asc(branch.createdAt), asc(branch.id));
}

/** The categories that hold at least one product visible online. */
export async function listStoreCategories(db: Queryable, orgId: string) {
  return db
    .select({ id: category.id, name: category.name })
    .from(category)
    .where(
      and(
        eq(category.orgId, orgId),
        inArray(
          category.id,
          db
            .select({ id: sql<string>`${cataloguePublic.categoryId}` })
            .from(cataloguePublic)
            .where(
              and(eq(cataloguePublic.orgId, orgId), sql`${cataloguePublic.categoryId} IS NOT NULL`),
            ),
        ),
      ),
    )
    .orderBy(asc(category.name));
}

/** Every visible product id, for the sitemap; availability changes by the hour, so it is not filtered here. */
export async function listStoreProductIds(db: Queryable, orgId: string) {
  return db
    .select({ id: cataloguePublic.productId })
    .from(cataloguePublic)
    .where(eq(cataloguePublic.orgId, orgId))
    .orderBy(asc(cataloguePublic.productId));
}

// Qualified by hand: in a one-table select Drizzle names the column bare, and inside the price and stock subqueries
// a bare product_id would be the subquery's own column.
const listed = sql.raw(`"catalogue_public"."product_id"`);

const productFields = {
  id: cataloguePublic.productId,
  sku: cataloguePublic.sku,
  name: cataloguePublic.name,
  baseUnit: cataloguePublic.baseUnit,
  categoryId: cataloguePublic.categoryId,
  imageAssetId: cataloguePublic.imageAssetId,
};

/** The till's price rule (`priceAt`) as a correlated subquery, so a whole page is priced in one query. */
const priceIn = (orgId: string, branchId: string, at: Date) => sql<string | null>`(
  SELECT ${price.amount} FROM ${price}
  WHERE ${price.orgId} = ${orgId} AND ${price.productId} = ${listed}
    AND (${price.branchId} = ${branchId} OR ${price.branchId} IS NULL)
    AND ${price.validFrom} <= ${at} AND (${price.validTo} IS NULL OR ${price.validTo} > ${at})
  ORDER BY (${price.branchId} IS NOT NULL) DESC, ${price.validFrom} DESC, ${price.id} DESC
  LIMIT 1)`;

async function storeBranch(db: Queryable, orgId: string, wanted?: string) {
  const branches = await listStoreBranches(db, orgId);
  const site = wanted ? branches.find((row) => row.id === wanted) : branches[0];
  if (!site)
    throw new StoreError(
      wanted ? "We could not find that branch" : "This shop has no branches yet",
    );
  return site;
}

const escape = (text: string) => text.replace(/[\\%_]/g, (match) => `\\${match}`);
