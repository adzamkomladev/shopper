import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { TaxClass } from "@shopper/tax";
import { branch, moneyColumn, tenant } from "./base";
import { user } from "./auth";
import { asset } from "./assets";

export const taxClass = pgTable(
  "tax_class",
  {
    ...tenant(),
    code: text("code").$type<TaxClass>().notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.code),
    check("tax_class_code", sql`${t.code} IN ('standard', 'zero-rated', 'exempt')`),
  ],
);
export const taxRule = pgTable(
  "tax_rule",
  {
    ...tenant(),
    effectiveFrom: date("effective_from").notNull(),
    vatBps: integer("vat_bps").notNull(),
    nhilBps: integer("nhil_bps").notNull(),
    getfundBps: integer("getfund_bps").notNull(),
    covidBps: integer("covid_bps").notNull(),
    source: text("source").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.effectiveFrom),
    check(
      "tax_rates",
      sql`${t.vatBps} BETWEEN 0 AND 10000 AND ${t.nhilBps} BETWEEN 0 AND 10000 AND ${t.getfundBps} BETWEEN 0 AND 10000 AND ${t.covidBps} BETWEEN 0 AND 10000`,
    ),
  ],
);
export const baseUnits = ["each", "kg", "g", "l", "ml"] as const;
export type BaseUnit = (typeof baseUnits)[number];

export const category = pgTable(
  "category",
  {
    ...tenant(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.parentId], foreignColumns: [t.orgId, t.id] }),
    // Coalesce so top-level categories (null parent) are unique too.
    uniqueIndex("category_org_name_parent").on(
      t.orgId,
      sql`lower(${t.name})`,
      sql`coalesce(${t.parentId}, ${t.orgId})`,
    ),
  ],
);
export const supplier = pgTable(
  "supplier",
  {
    ...tenant(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    tin: text("tin"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    uniqueIndex("supplier_org_name").on(t.orgId, sql`lower(${t.name})`),
  ],
);
export const product = pgTable(
  "product",
  {
    ...tenant(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    categoryId: uuid("category_id"),
    supplierId: uuid("supplier_id"),
    taxClassId: uuid("tax_class_id").notNull(),
    baseUnit: text("base_unit").$type<BaseUnit>().notNull(),
    onlineVisible: boolean("online_visible").notNull().default(false),
    /** A final-sale product cannot be returned or refunded. */
    finalSale: boolean("final_sale").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.sku),
    foreignKey({ columns: [t.orgId, t.categoryId], foreignColumns: [category.orgId, category.id] }),
    foreignKey({ columns: [t.orgId, t.supplierId], foreignColumns: [supplier.orgId, supplier.id] }),
    foreignKey({ columns: [t.orgId, t.taxClassId], foreignColumns: [taxClass.orgId, taxClass.id] }),
    check("product_base_unit", sql`${t.baseUnit} IN ('each', 'kg', 'g', 'l', 'ml')`),
  ],
);
/** A scannable code. quantity_thousandths converts one scan to base units (a case of 24 = 24000). */
export const productBarcode = pgTable(
  "product_barcode",
  {
    ...tenant(),
    productId: uuid("product_id").notNull(),
    code: text("code").notNull(),
    quantityThousandths: integer("quantity_thousandths").notNull().default(1000),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.code),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    index().on(t.orgId, t.productId),
    check("product_barcode_quantity", sql`${t.quantityThousandths} > 0`),
  ],
);
/** Append-only VAT-inclusive shelf price versions. A null branch applies to every branch. */
export const price = pgTable(
  "price",
  {
    ...tenant(),
    productId: uuid("product_id").notNull(),
    branchId: uuid("branch_id"),
    amount: moneyColumn("amount").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    reason: text("reason"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    index().on(t.orgId, t.productId, t.branchId, t.validFrom.desc()),
    check("price_amount_positive", sql`${t.amount} > 0`),
    check("price_window", sql`${t.validTo} IS NULL OR ${t.validTo} > ${t.validFrom}`),
  ],
);
export const productImport = pgTable(
  "product_import",
  {
    ...tenant(),
    assetId: uuid("asset_id"),
    fileName: text("file_name").notNull(),
    sha256: text("sha256").notNull(),
    rowsTotal: integer("rows_total").notNull(),
    rowsOk: integer("rows_ok").notNull(),
    rowsFailed: integer("rows_failed").notNull(),
    report: jsonb("report").notNull(),
    priceValidFrom: timestamp("price_valid_from", { withTimezone: true }).notNull(),
    actorId: uuid("actor_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    unique("product_import_asset").on(t.orgId, t.assetId),
    foreignKey({ columns: [t.orgId, t.assetId], foreignColumns: [asset.orgId, asset.id] }),
  ],
);
/** An embedded-code label layout: EAN-13 digits 2..11 carry a product slice and a weight or price slice. */
export const barcodeMapping = pgTable(
  "barcode_mapping",
  {
    ...tenant(),
    prefix: integer("prefix").notNull(),
    productStart: integer("product_start").notNull(),
    productLength: integer("product_length").notNull(),
    valueStart: integer("value_start").notNull(),
    valueLength: integer("value_length").notNull(),
    kind: text("kind", { enum: ["weight", "price"] }).notNull(),
    unit: text("unit", { enum: ["g", "kg"] }),
    decimals: integer("decimals").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.prefix),
    check("barcode_mapping_prefix", sql`${t.prefix} BETWEEN 20 AND 29`),
    check(
      "barcode_mapping_slices",
      sql`${t.productStart} >= 2 AND ${t.productLength} >= 1 AND ${t.productStart} + ${t.productLength} <= 12 AND ${t.valueStart} >= 2 AND ${t.valueLength} >= 1 AND ${t.valueStart} + ${t.valueLength} <= 12 AND (${t.productStart} + ${t.productLength} <= ${t.valueStart} OR ${t.valueStart} + ${t.valueLength} <= ${t.productStart})`,
    ),
    check(
      "barcode_mapping_kind",
      sql`(${t.kind} = 'weight' AND ${t.unit} IN ('g', 'kg')) OR (${t.kind} = 'price' AND ${t.unit} IS NULL)`,
    ),
    check("barcode_mapping_decimals", sql`${t.decimals} BETWEEN 0 AND 4`),
  ],
);
