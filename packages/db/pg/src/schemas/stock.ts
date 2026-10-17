import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant, branch } from "./base";
import { user } from "./auth";
import { device } from "./devices";
import { product } from "./catalogue";
import { sale, saleLine } from "./sales";

export const stockReasons = ["sale", "adjustment", "return", "count", "receipt"] as const;
export const stockDocumentKinds = ["count", "receipt"] as const;

/** A stock count or receiving note taken on a till, keyed by the till's UUIDv7. */
export const stockDocument = pgTable(
  "stock_document",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    kind: text("kind", { enum: stockDocumentKinds }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    contentHash: text("content_hash").notNull(),
    payload: jsonb("payload").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.deviceId], foreignColumns: [device.orgId, device.id] }),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    check("stock_document_kind", sql`${t.kind} IN ('count', 'receipt')`),
  ],
);

/** Signed stock ledger: a sale is negative. */
export const stockMovement = pgTable(
  "stock_movement",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    productId: uuid("product_id").notNull(),
    saleId: uuid("sale_id"),
    saleLineId: uuid("sale_line_id"),
    documentId: uuid("document_id"),
    quantityThousandths: bigint("quantity_thousandths", { mode: "number" }).notNull(),
    reason: text("reason", { enum: stockReasons }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    index("stock_movement_product").on(t.orgId, t.branchId, t.productId, t.occurredAt),
    index("stock_movement_sale").on(t.orgId, t.saleId),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    foreignKey({ columns: [t.orgId, t.saleId], foreignColumns: [sale.orgId, sale.id] }),
    foreignKey({ columns: [t.orgId, t.saleLineId], foreignColumns: [saleLine.orgId, saleLine.id] }),
    foreignKey({
      columns: [t.orgId, t.documentId],
      foreignColumns: [stockDocument.orgId, stockDocument.id],
    }),
    check(
      "stock_movement_reason",
      sql`${t.reason} IN ('sale', 'adjustment', 'return', 'count', 'receipt')`,
    ),
    check(
      "stock_movement_document",
      sql`${t.reason} NOT IN ('count', 'receipt') OR ${t.documentId} IS NOT NULL`,
    ),
    check("stock_movement_receipt", sql`${t.reason} <> 'receipt' OR ${t.quantityThousandths} > 0`),
    check("stock_movement_quantity", sql`${t.quantityThousandths} <> 0`),
    check(
      "stock_movement_sale",
      sql`${t.reason} <> 'sale' OR (${t.saleId} IS NOT NULL AND ${t.quantityThousandths} < 0)`,
    ),
  ],
);
