import { sql } from "drizzle-orm";
import type { EntityDefinition } from "../types";

const accra = (column: string) => sql.raw(`${column} AT TIME ZONE 'Africa/Accra'`);
const tax = (key: string) => sql.raw(`(t.payload->'tax'->>'${key}')::bigint`);

/** What happened: sales, their lines and tenders, and the audit trail, each within a day range (Accra days). */
export const tradingEntities: Record<"sales" | "lines" | "tenders" | "audit", EntityDefinition> = {
  sales: {
    day: accra("t.occurred_at"),
    from: sql`sale t
      JOIN store st ON st.org_id = t.org_id AND st.id = t.store_id
      JOIN branch b ON b.org_id = t.org_id AND b.id = t.branch_id
      JOIN "user" u ON u.org_id = t.org_id AND u.id = t.cashier_id
      LEFT JOIN customer c ON c.org_id = t.org_id AND c.id = t.customer_id`,
    columns: [
      { header: "Receipt", kind: "text", sql: sql`t.receipt_number` },
      {
        header: "Time",
        kind: "text",
        sql: sql`to_char(${accra("t.occurred_at")}, 'YYYY-MM-DD HH24:MI:SS')`,
      },
      { header: "Store", kind: "text", sql: sql`st.name` },
      { header: "Branch", kind: "text", sql: sql`b.name` },
      { header: "Cashier", kind: "text", sql: sql`u.name` },
      { header: "Customer", kind: "text", sql: sql`c.name` },
      { header: "Status", kind: "text", sql: sql`t.status` },
      { header: "Total", kind: "money", sql: sql`t.total` },
      { header: "Cash rounding", kind: "money", sql: sql`t.cash_rounding` },
      { header: "Paid", kind: "money", sql: sql`t.paid` },
      { header: "Change", kind: "money", sql: sql`t.change` },
    ],
  },
  lines: {
    day: accra("s.occurred_at"),
    from: sql`sale_line t
      JOIN sale s ON s.org_id = t.org_id AND s.id = t.sale_id
      JOIN product p ON p.org_id = t.org_id AND p.id = t.product_id`,
    columns: [
      { header: "Receipt", kind: "text", sql: sql`s.receipt_number` },
      {
        header: "Time",
        kind: "text",
        sql: sql`to_char(${accra("s.occurred_at")}, 'YYYY-MM-DD HH24:MI:SS')`,
      },
      { header: "SKU", kind: "text", sql: sql`p.sku` },
      { header: "Product", kind: "text", sql: sql`p.name` },
      { header: "Quantity", kind: "quantity", sql: tax("quantityThousandths") },
      { header: "Unit price", kind: "money", sql: tax("unitPrice") },
      { header: "Discount", kind: "money", sql: tax("discount") },
      { header: "Net", kind: "money", sql: tax("base") },
      { header: "VAT", kind: "money", sql: tax("vat") },
      { header: "NHIL", kind: "money", sql: tax("nhil") },
      { header: "GETFund", kind: "money", sql: tax("getfund") },
      { header: "COVID levy", kind: "money", sql: tax("covid") },
      { header: "Gross", kind: "money", sql: tax("gross") },
    ],
  },
  tenders: {
    day: accra("s.occurred_at"),
    from: sql`sale_tender t
      JOIN sale s ON s.org_id = t.org_id AND s.id = t.sale_id`,
    columns: [
      { header: "Receipt", kind: "text", sql: sql`s.receipt_number` },
      {
        header: "Time",
        kind: "text",
        sql: sql`to_char(${accra("s.occurred_at")}, 'YYYY-MM-DD HH24:MI:SS')`,
      },
      { header: "Kind", kind: "text", sql: sql`t.kind` },
      { header: "Amount", kind: "money", sql: sql`t.amount` },
      { header: "Network", kind: "text", sql: sql`t.network` },
      { header: "Reference", kind: "text", sql: sql`t.reference` },
    ],
  },
  audit: {
    day: accra("t.created_at"),
    from: sql`audit_log t LEFT JOIN "user" u ON u.org_id = t.org_id AND u.id = t.actor_id`,
    columns: [
      {
        header: "Time",
        kind: "text",
        sql: sql`to_char(${accra("t.created_at")}, 'YYYY-MM-DD HH24:MI:SS')`,
      },
      { header: "Command", kind: "text", sql: sql`t.command` },
      { header: "Actor", kind: "text", sql: sql`u.name` },
      { header: "Role", kind: "text", sql: sql`t.role` },
      { header: "Entity", kind: "text", sql: sql`t.entity` },
      { header: "Entity id", kind: "text", sql: sql`t.entity_id::text` },
      { header: "Reason", kind: "text", sql: sql`t.reason` },
      { header: "Sequence", kind: "count", sql: sql`t.chain_seq` },
      { header: "Hash", kind: "text", sql: sql`t.hash` },
    ],
  },
};
