import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { asset, cataloguePublic } from "@shopper/db-pg";
import { storeId } from "../schemas/storefront/query";
import type { Queryable } from "../types";

/** The storage key of a photo the store may show: a product image linked to a product in `catalogue_public`. */
export async function storeImageKey(db: Queryable, orgId: string, assetId: string) {
  if (!v.is(storeId, assetId)) return null;
  const [found] = await db
    .select({ key: asset.key })
    .from(asset)
    .innerJoin(
      cataloguePublic,
      and(eq(cataloguePublic.orgId, asset.orgId), eq(cataloguePublic.imageAssetId, asset.id)),
    )
    .where(and(eq(asset.orgId, orgId), eq(asset.id, assetId), eq(asset.purpose, "product_image")))
    .limit(1);
  return found?.key ?? null;
}
