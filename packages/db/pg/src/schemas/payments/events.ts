import { sql } from "drizzle-orm";
import { check, pgTable, text, unique } from "drizzle-orm/pg-core";
import { tenant, momoProviders } from "../base";

/**
 * Every provider callback applied, keyed by the provider's own event identity. The insert shares the transaction
 * that applies the event, so a replayed webhook finds its key and changes nothing.
 */
export const paymentEvent = pgTable(
  "payment_event",
  {
    ...tenant(),
    provider: text("provider", { enum: momoProviders }).notNull(),
    key: text("key").notNull(),
    reference: text("reference").notNull(),
    kind: text("kind").notNull(),
  },
  (t) => [
    unique().on(t.orgId, t.provider, t.key),
    check("payment_event_provider", sql`${t.provider} IN ('paystack', 'hubtel')`),
  ],
);
