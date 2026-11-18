import { boolean, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { org, tenant } from "./base";

/**
 * A box enrolled to publish to its relay org (v1.5): one row per licence, the relay org being the licence's `org`.
 * Platform staff switch Online Orders and revoke; the relay refuses a revoked licence or one without the add-on.
 */
export const relayBox = pgTable("relay_box", {
  ...tenant(),
  licenceId: uuid("licence_id").notNull().unique(),
  machine: text("machine").notNull(),
  onlineOrders: boolean("online_orders").notNull().default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

/** Each accepted relay request's signature (SHA-256), kept for its freshness window so a replay is refused. */
export const relayNonce = pgTable(
  "relay_nonce",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id),
    licenceId: uuid("licence_id").notNull(),
    digest: text("digest").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.licenceId, t.digest] })],
);
