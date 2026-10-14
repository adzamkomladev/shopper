import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Search projections of `reference` products. The FTS5 table `product_search` is raw SQL (rowid = product_lookup rowid). */
export const productLookup = sqliteTable(
  "product_lookup",
  {
    orgId: text("org_id").notNull(),
    productId: text("product_id").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.productId] }),
    index("product_lookup_sku").on(t.orgId, t.sku),
  ],
);

export const productBarcode = sqliteTable(
  "product_barcode",
  {
    orgId: text("org_id").notNull(),
    code: text("code").notNull(),
    productId: text("product_id").notNull(),
    quantityThousandths: integer("quantity_thousandths").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.code] }),
    index("product_barcode_product").on(t.orgId, t.productId),
  ],
);
