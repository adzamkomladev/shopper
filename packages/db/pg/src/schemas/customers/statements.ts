import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant } from "../base";
import { user } from "../auth";
import { customer } from "./base";

/** A signed, expiring, revocable link a customer opens without signing in. The row only counts views. */
export const statementLink = pgTable(
  "statement_link",
  {
    ...tenant(),
    customerId: uuid("customer_id").notNull(),
    periodFrom: date("period_from", { mode: "string" }).notNull(),
    periodTo: date("period_to", { mode: "string" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdBy: uuid("created_by").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    foreignKey({ columns: [t.orgId, t.customerId], foreignColumns: [customer.orgId, customer.id] }),
    foreignKey({ columns: [t.orgId, t.createdBy], foreignColumns: [user.orgId, user.id] }),
    check("statement_link_period", sql`${t.periodFrom} <= ${t.periodTo}`),
    check("statement_link_views", sql`${t.viewCount} >= 0`),
  ],
);

export const deliveryChannels = ["sms", "email", "pdf"] as const;
export const deliveryStatuses = ["queued", "sent", "failed"] as const;

/** One statement sent over one channel for one period; the unique key makes a repeat run a no-op. */
export const statementDelivery = pgTable(
  "statement_delivery",
  {
    ...tenant(),
    customerId: uuid("customer_id").notNull(),
    linkId: uuid("link_id"),
    channel: text("channel", { enum: deliveryChannels }).notNull(),
    periodFrom: date("period_from", { mode: "string" }).notNull(),
    periodTo: date("period_to", { mode: "string" }).notNull(),
    status: text("status", { enum: deliveryStatuses }).notNull().default("queued"),
    providerReference: text("provider_reference"),
    actorId: uuid("actor_id"),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("statement_delivery_period").on(
      t.orgId,
      t.customerId,
      t.periodFrom,
      t.periodTo,
      t.channel,
    ),
    foreignKey({
      columns: [t.orgId, t.customerId],
      foreignColumns: [customer.orgId, customer.id],
    }),
    foreignKey({
      columns: [t.orgId, t.linkId],
      foreignColumns: [statementLink.orgId, statementLink.id],
    }),
    foreignKey({ columns: [t.orgId, t.actorId], foreignColumns: [user.orgId, user.id] }),
    check("statement_delivery_channel", sql`${t.channel} IN ('sms', 'email', 'pdf')`),
    check("statement_delivery_status", sql`${t.status} IN ('queued', 'sent', 'failed')`),
    check("statement_delivery_period_order", sql`${t.periodFrom} <= ${t.periodTo}`),
  ],
);
