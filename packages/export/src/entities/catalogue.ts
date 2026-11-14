import { sql } from "drizzle-orm";
import type { EntityDefinition } from "../types";

const when = (column: string) =>
  sql.raw(`to_char(${column} AT TIME ZONE 'Africa/Accra', 'YYYY-MM-DD HH24:MI:SS')`);

/** The lists an owner keeps: what they sell, at what price, to whom, how much is on the shelf, and the tax rules. */
export const catalogueEntities: Record<
  "products" | "prices" | "customers" | "stock" | "tax",
  EntityDefinition
> = {
  products: {
    from: sql`product t
      LEFT JOIN category c ON c.org_id = t.org_id AND c.id = t.category_id
      LEFT JOIN supplier s ON s.org_id = t.org_id AND s.id = t.supplier_id
      JOIN tax_class k ON k.org_id = t.org_id AND k.id = t.tax_class_id`,
    columns: [
      { header: "SKU", kind: "text", sql: sql`t.sku` },
      { header: "Name", kind: "text", sql: sql`t.name` },
      { header: "Category", kind: "text", sql: sql`c.name` },
      { header: "Supplier", kind: "text", sql: sql`s.name` },
      { header: "Tax class", kind: "text", sql: sql`k.code` },
      { header: "Unit", kind: "text", sql: sql`t.base_unit` },
      {
        header: "Sold online",
        kind: "text",
        sql: sql`CASE WHEN t.online_visible THEN 'yes' ELSE 'no' END`,
      },
      { header: "Archived", kind: "text", sql: when("t.archived_at") },
    ],
  },
  prices: {
    from: sql`price t
      JOIN product p ON p.org_id = t.org_id AND p.id = t.product_id
      LEFT JOIN branch b ON b.org_id = t.org_id AND b.id = t.branch_id`,
    columns: [
      { header: "SKU", kind: "text", sql: sql`p.sku` },
      { header: "Product", kind: "text", sql: sql`p.name` },
      { header: "Branch", kind: "text", sql: sql`coalesce(b.name, 'All branches')` },
      { header: "Price", kind: "money", sql: sql`t.amount` },
      { header: "Valid from", kind: "text", sql: when("t.valid_from") },
      { header: "Valid to", kind: "text", sql: when("t.valid_to") },
      { header: "Reason", kind: "text", sql: sql`t.reason` },
    ],
  },
  customers: {
    from: sql`customer t`,
    columns: [
      { header: "Name", kind: "text", sql: sql`t.name` },
      { header: "Phone", kind: "text", sql: sql`t.phone` },
      { header: "Kind", kind: "text", sql: sql`t.kind` },
      { header: "Business", kind: "text", sql: sql`t.business_name` },
      { header: "TIN", kind: "text", sql: sql`t.tin` },
      { header: "Email", kind: "text", sql: sql`t.email` },
      { header: "Credit limit", kind: "money", sql: sql`t.credit_limit` },
      { header: "Verified", kind: "text", sql: when("t.kyc_verified_at") },
      { header: "Archived", kind: "text", sql: when("t.archived_at") },
    ],
  },
  // On hand is a sum, so a row is a (branch, product) pair, not a table row: it is read in one query.
  stock: {
    paged: false,
    from: sql`(SELECT org_id, branch_id, product_id, sum(quantity_thousandths) AS on_hand
        FROM stock_movement GROUP BY org_id, branch_id, product_id) t
      JOIN product p ON p.org_id = t.org_id AND p.id = t.product_id
      JOIN branch b ON b.org_id = t.org_id AND b.id = t.branch_id`,
    order: sql`b.name, p.sku`,
    columns: [
      { header: "Branch", kind: "text", sql: sql`b.name` },
      { header: "SKU", kind: "text", sql: sql`p.sku` },
      { header: "Product", kind: "text", sql: sql`p.name` },
      { header: "On hand", kind: "quantity", sql: sql`t.on_hand` },
    ],
  },
  tax: {
    from: sql`tax_rule t`,
    columns: [
      { header: "Effective from", kind: "text", sql: sql`t.effective_from::text` },
      { header: "VAT", kind: "bps", sql: sql`t.vat_bps` },
      { header: "NHIL", kind: "bps", sql: sql`t.nhil_bps` },
      { header: "GETFund", kind: "bps", sql: sql`t.getfund_bps` },
      { header: "COVID levy", kind: "bps", sql: sql`t.covid_bps` },
      { header: "Source", kind: "text", sql: sql`t.source` },
    ],
  },
};
