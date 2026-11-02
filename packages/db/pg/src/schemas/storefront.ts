import { pgView, text, uuid } from "drizzle-orm/pg-core";
import type { BaseUnit } from "./catalogue";

/**
 * The products the online store may show: visible online and not archived (migration 0037). The store reads products
 * only through this view, so on-prem relay data can stand behind it later.
 */
export const cataloguePublic = pgView("catalogue_public", {
  orgId: uuid("org_id").notNull(),
  productId: uuid("product_id").notNull(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  categoryId: uuid("category_id"),
  baseUnit: text("base_unit").$type<BaseUnit>().notNull(),
  imageAssetId: uuid("image_asset_id"),
}).existing();
