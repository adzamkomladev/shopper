import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { branch, tenant } from "../base";
import { product } from "../catalogue";
import { onlineOrder } from "./base";
import { orderPaymentMethods } from "./payments";

/** What made a report line: the paid order itself, the change its picking made, or a refund of what was kept. */
export const orderReportSources = ["order", "adjustment", "refund"] as const;
export const orderReportKinds = ["sale", "refund"] as const;

/**
 * One item an online order sold or gave back, as the reports count it: written in the same command as the order's
 * receipt, credit note or supplementary invoice, whether or not the shop is VAT registered. `product_id` is null for
 * the delivery fee. `tax` is the item's tax snapshot; `tender` is how the shopper paid.
 */
export const orderReportLine = pgTable(
  "order_report_line",
  {
    ...tenant(),
    orderId: uuid("order_id").notNull(),
    storeId: uuid("store_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    source: text("source", { enum: orderReportSources }).notNull(),
    kind: text("kind", { enum: orderReportKinds }).notNull(),
    productId: uuid("product_id"),
    tender: text("tender", { enum: orderPaymentMethods }).notNull(),
    tax: jsonb("tax").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("order_report_line_day").on(t.orgId, t.storeId, t.occurredAt),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    check("order_report_line_source", sql`${t.source} IN ('order', 'adjustment', 'refund')`),
    check("order_report_line_kind", sql`${t.kind} IN ('sale', 'refund')`),
    check("order_report_line_tender", sql`${t.tender} IN ('card', 'momo')`),
  ],
);
