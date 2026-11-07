import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { moneyColumn, tenant } from "../base";
import { product } from "../catalogue";
import { onlineOrder, onlineOrderLine } from "./base";
import { orderRefund } from "./payments";

export const pickOutcomes = ["picked", "short", "substituted"] as const;

/**
 * What the picker found for one product line of an order: all of it, some of it (the rest is short), or a
 * substitute for the missing quantity. `substitute_gross` is what the shopper is charged for the substitute.
 */
export const onlineOrderPick = pgTable(
  "online_order_pick",
  {
    ...tenant(),
    orderId: uuid("order_id").notNull(),
    lineId: uuid("line_id").notNull(),
    outcome: text("outcome", { enum: pickOutcomes }).notNull(),
    pickedThousandths: integer("picked_thousandths").notNull(),
    substituteProductId: uuid("substitute_product_id"),
    substituteQuantityThousandths: integer("substitute_quantity_thousandths"),
    substituteGross: moneyColumn("substitute_gross"),
    /** The substitute's name and tax snapshot, as a line's payload holds them. */
    substitutePayload: jsonb("substitute_payload"),
    pickerId: uuid("picker_id"),
    pickedAt: timestamp("picked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("online_order_pick_line").on(t.orgId, t.orderId, t.lineId),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    foreignKey({
      columns: [t.orgId, t.lineId],
      foreignColumns: [onlineOrderLine.orgId, onlineOrderLine.id],
    }),
    foreignKey({
      columns: [t.orgId, t.substituteProductId],
      foreignColumns: [product.orgId, product.id],
    }),
    check("online_order_pick_quantity", sql`${t.pickedThousandths} >= 0`),
    check(
      "online_order_pick_substitute",
      sql`(${t.outcome} = 'substituted') = (${t.substituteProductId} IS NOT NULL
        AND ${t.substituteQuantityThousandths} > 0 AND ${t.substituteGross} IS NOT NULL
        AND ${t.substitutePayload} IS NOT NULL)`,
    ),
  ],
);

/**
 * The result of finishing a pick that changed the order: what the shopper was charged before and after, the refund
 * for the difference, and the credit note and supplementary invoice that said so. One per order.
 */
export const onlineOrderAdjustment = pgTable(
  "online_order_adjustment",
  {
    ...tenant(),
    orderId: uuid("order_id").notNull(),
    beforeGross: moneyColumn("before_gross").notNull(),
    afterGross: moneyColumn("after_gross").notNull(),
    refundAmount: moneyColumn("refund_amount").notNull(),
    refundId: uuid("refund_id"),
    creditNoteNumber: text("credit_note_number"),
    supplementNumber: text("supplement_number"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("online_order_adjustment_order").on(t.orgId, t.orderId),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    foreignKey({
      columns: [t.orgId, t.refundId],
      foreignColumns: [orderRefund.orgId, orderRefund.id],
    }),
    check(
      "online_order_adjustment_sum",
      sql`${t.afterGross} + ${t.refundAmount} = ${t.beforeGross}`,
    ),
  ],
);
