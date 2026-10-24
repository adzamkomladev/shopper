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
import { tenant, moneyColumn } from "../base";
import { customer } from "./base";

/** A loyalty tier: reached by spending at least `minSpend` over the trailing 365 days, earning at `earnBps`. */
export const loyaltyTier = pgTable(
  "loyalty_tier",
  {
    ...tenant(),
    name: text("name").notNull(),
    minSpend: moneyColumn("min_spend").notNull(),
    earnBps: integer("earn_bps").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    check("loyalty_tier_values", sql`${t.minSpend} >= 0 AND ${t.earnBps} BETWEEN 0 AND 10000`),
  ],
);

export const noticeChannels = ["sms", "email"] as const;

/** A tier downgrade announced to a customer, once per customer, tier and effective day. */
export const tierNotice = pgTable(
  "tier_notice",
  {
    ...tenant(),
    customerId: uuid("customer_id").notNull(),
    fromTierId: uuid("from_tier_id").notNull(),
    /** The tier they fall to; null means no tier. */
    toTierId: uuid("to_tier_id"),
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    channel: text("channel", { enum: noticeChannels }),
  },
  (t) => [
    unique().on(t.orgId, t.customerId, t.fromTierId, t.effectiveOn),
    foreignKey({ columns: [t.orgId, t.customerId], foreignColumns: [customer.orgId, customer.id] }),
    foreignKey({
      columns: [t.orgId, t.fromTierId],
      foreignColumns: [loyaltyTier.orgId, loyaltyTier.id],
    }),
    foreignKey({
      columns: [t.orgId, t.toTierId],
      foreignColumns: [loyaltyTier.orgId, loyaltyTier.id],
    }),
    check("tier_notice_channel", sql`${t.channel} IS NULL OR ${t.channel} IN ('sms', 'email')`),
    check("tier_notice_sent", sql`(${t.sentAt} IS NULL) = (${t.channel} IS NULL)`),
  ],
);
