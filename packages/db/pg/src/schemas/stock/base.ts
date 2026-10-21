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
import { tenant, branch, moneyColumn } from "../base";
import { user } from "../auth";
import { device } from "../devices";
import { product, supplier } from "../catalogue";
import { sale, saleLine } from "../sales";
import { refund, refundLine } from "../refunds";

export const stockReasons = ["sale", "adjustment", "return", "count", "receipt"] as const;
export const stockDocumentKinds = ["count", "receipt", "adjustment"] as const;
export const adjustmentCauses = ["damaged", "expired", "theft", "found", "other"] as const;

/** A stock count, receiving note or adjustment: from a till (device) or the back office (no device), keyed by a UUIDv7. */
export const stockDocument = pgTable(
  "stock_document",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    deviceId: uuid("device_id"),
    supplierId: uuid("supplier_id"),
    cause: text("cause", { enum: adjustmentCauses }),
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
    foreignKey({
      columns: [t.orgId, t.supplierId],
      foreignColumns: [supplier.orgId, supplier.id],
    }),
    index("stock_document_kind").on(t.orgId, t.branchId, t.kind, t.occurredAt),
    check("stock_document_kind", sql`${t.kind} IN ('count', 'receipt', 'adjustment')`),
    check("stock_document_cause", sql`(${t.kind} = 'adjustment') = (${t.cause} IS NOT NULL)`),
    check(
      "stock_document_cause_value",
      sql`${t.cause} IS NULL OR ${t.cause} IN ('damaged', 'expired', 'theft', 'found', 'other')`,
    ),
    check(
      "stock_document_receipt_source",
      sql`${t.kind} <> 'receipt' OR ${t.deviceId} IS NOT NULL OR ${t.supplierId} IS NOT NULL`,
    ),
  ],
);

/** Signed stock ledger: a sale is negative, a return positive. */
export const stockMovement = pgTable(
  "stock_movement",
  {
    ...tenant(),
    branchId: uuid("branch_id").notNull(),
    productId: uuid("product_id").notNull(),
    saleId: uuid("sale_id"),
    saleLineId: uuid("sale_line_id"),
    documentId: uuid("document_id"),
    refundId: uuid("refund_id"),
    refundLineId: uuid("refund_line_id"),
    quantityThousandths: bigint("quantity_thousandths", { mode: "number" }).notNull(),
    /** Cost of one base unit; set on costed receipts only. */
    unitCost: moneyColumn("unit_cost"),
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
    foreignKey({ columns: [t.orgId, t.refundId], foreignColumns: [refund.orgId, refund.id] }),
    foreignKey({
      columns: [t.orgId, t.refundLineId],
      foreignColumns: [refundLine.orgId, refundLine.id],
    }),
    check(
      "stock_movement_return",
      sql`${t.reason} <> 'return' OR (${t.refundId} IS NOT NULL AND ${t.quantityThousandths} > 0)`,
    ),
    check(
      "stock_movement_reason",
      sql`${t.reason} IN ('sale', 'adjustment', 'return', 'count', 'receipt')`,
    ),
    check(
      "stock_movement_document",
      sql`${t.reason} NOT IN ('count', 'receipt') OR ${t.documentId} IS NOT NULL`,
    ),
    check("stock_movement_receipt", sql`${t.reason} <> 'receipt' OR ${t.quantityThousandths} > 0`),
    check(
      "stock_movement_unit_cost",
      sql`${t.unitCost} IS NULL OR (${t.reason} = 'receipt' AND ${t.unitCost} >= 0)`,
    ),
    check("stock_movement_quantity", sql`${t.quantityThousandths} <> 0`),
    check(
      "stock_movement_sale",
      sql`${t.reason} <> 'sale' OR (${t.saleId} IS NOT NULL AND ${t.quantityThousandths} < 0)`,
    ),
  ],
);
