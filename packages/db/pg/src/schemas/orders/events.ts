import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { tenant } from "../base";
import { onlineOrder, orderStatuses } from "./base";

/**
 * Each status an online order reached, once. It is the order's timeline for the shopper and the once-only record of
 * which status change has been told to them (`notified_at`).
 */
export const onlineOrderEvent = pgTable(
  "online_order_event",
  {
    ...tenant(),
    orderId: uuid("order_id").notNull(),
    status: text("status", { enum: orderStatuses }).notNull(),
    actorId: uuid("actor_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("online_order_event_status").on(t.orgId, t.orderId, t.status),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    check(
      "online_order_event_status_value",
      sql`${t.status} IN (${sql.raw(orderStatuses.map((status) => `'${status}'`).join(", "))})`,
    ),
  ],
);
