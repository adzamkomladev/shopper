import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { branch, moneyColumn, store, tenant } from "../base";
import { price, product } from "../catalogue";
import { shopAccount } from "../shop";

export const orderChannels = ["online"] as const;
export const orderStatuses = ["placed", "expired", "cancelled", "paid", "accepted"] as const;
export const fulfilmentKinds = ["pickup", "delivery"] as const;

/**
 * An order from the online store. `channel` names where it came from (v1.5 adds relayed on-prem orders);
 * `inbox_cursor` is the store's sequence at placement, so an order inbox resumes from a cursor. Totals are the
 * snapshot the customer was shown when the order was placed.
 */
export const onlineOrder = pgTable(
  "online_order",
  {
    ...tenant(),
    channel: text("channel", { enum: orderChannels }).notNull().default("online"),
    status: text("status", { enum: orderStatuses }).notNull().default("placed"),
    storeId: uuid("store_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    inboxCursor: bigint("inbox_cursor", { mode: "bigint" }).notNull(),
    fulfilment: text("fulfilment", { enum: fulfilmentKinds }).notNull(),
    slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
    slotEnd: timestamp("slot_end", { withTimezone: true }).notNull(),
    deliveryAddress: jsonb("delivery_address"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    shopAccountId: uuid("shop_account_id"),
    /**
     * SHA-256 of the browser's random checkout key. The key reads the order back, and a repeated submit with the same
     * key returns the same order instead of a second one.
     */
    viewTokenDigest: text("view_token_digest").notNull(),
    base: moneyColumn("base").notNull(),
    vat: moneyColumn("vat").notNull(),
    nhil: moneyColumn("nhil").notNull(),
    getfund: moneyColumn("getfund").notNull(),
    covid: moneyColumn("covid").notNull(),
    gross: moneyColumn("gross").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }).notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("online_order_cursor").on(t.orgId, t.storeId, t.inboxCursor),
    unique("online_order_token").on(t.viewTokenDigest),
    index("online_order_slot").on(t.orgId, t.branchId, t.slotStart),
    foreignKey({ columns: [t.orgId, t.storeId], foreignColumns: [store.orgId, store.id] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({
      columns: [t.orgId, t.shopAccountId],
      foreignColumns: [shopAccount.orgId, shopAccount.id],
    }),
    check("online_order_phone_format", sql`${t.customerPhone} ~ '^0[0-9]{9}$'`),
    check("online_order_slot_order", sql`${t.slotEnd} > ${t.slotStart}`),
    check(
      "online_order_address",
      sql`(${t.fulfilment} = 'delivery') = (${t.deliveryAddress} IS NOT NULL)`,
    ),
  ],
);

export const orderLineKinds = ["product", "delivery"] as const;

/**
 * One line of an online order with the tax snapshot (rates included) it was sold at. A product line names the price version the
 * customer saw (`price_id`); the delivery fee is a line of its own with no product.
 */
export const onlineOrderLine = pgTable(
  "online_order_line",
  {
    ...tenant(),
    orderId: uuid("order_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind", { enum: orderLineKinds }).notNull(),
    productId: uuid("product_id"),
    priceId: uuid("price_id"),
    quantityThousandths: integer("quantity_thousandths").notNull(),
    gross: moneyColumn("gross").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique().on(t.orgId, t.orderId, t.position),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
    foreignKey({ columns: [t.orgId, t.priceId], foreignColumns: [price.orgId, price.id] }),
    check(
      "online_order_line_kind",
      sql`(${t.kind} = 'product') = (${t.productId} IS NOT NULL AND ${t.priceId} IS NOT NULL)`,
    ),
    check("online_order_line_quantity", sql`${t.quantityThousandths} > 0`),
  ],
);
