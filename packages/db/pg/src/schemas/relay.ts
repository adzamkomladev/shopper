import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { branch, moneyColumn, org, tenant } from "./base";
import { product } from "./catalogue";

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

/**
 * On a box: the hash of each row its relay org has acknowledged, so the Publisher sends only what changed. Empty means
 * the next publish is a full snapshot.
 */
export const relayPublished = pgTable(
  "relay_published",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id),
    entity: text("entity", {
      enum: [
        "shop",
        "store",
        "branch",
        "fulfilment",
        "category",
        "product",
        "price",
        "availability",
        "customer",
      ],
    }).notNull(),
    entityId: uuid("entity_id").notNull(),
    hash: text("hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.entity, t.entityId] })],
);

/**
 * On a relay org: what its box says each branch can still sell online, floored to a step (v1.5 Day 49). The store's
 * `availableOf` adds it to on hand; only the box's publish writes it (relay lock).
 */
export const onlineAvailability = pgTable(
  "online_availability",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id),
    branchId: uuid("branch_id").notNull(),
    productId: uuid("product_id").notNull(),
    quantityThousandths: integer("quantity_thousandths").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.branchId, t.productId] }),
    foreignKey({ columns: [t.orgId, t.branchId], foreignColumns: [branch.orgId, branch.id] }),
    foreignKey({ columns: [t.orgId, t.productId], foreignColumns: [product.orgId, product.id] }),
  ],
);

/**
 * On a relay org: a box customer who agreed to see their receipts and points online (v1.5 Day 51), keyed by the box's
 * customer id. `points` is what the box's own account code shows for their phone; only the box's publish writes it.
 */
export const relayCustomer = pgTable(
  "relay_customer",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id),
    id: uuid("id").notNull(),
    phone: text("phone").notNull(),
    points: jsonb("points").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.id] }),
    index("relay_customer_phone").on(t.orgId, t.phone),
  ],
);

/** On a relay org: one of a published customer's till receipts, as the box's account code lists it (v1.5 Day 51). */
export const relayReceipt = pgTable(
  "relay_receipt",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id),
    /** The box's sale id. */
    id: uuid("id").notNull(),
    customerId: uuid("customer_id").notNull(),
    receiptNumber: text("receipt_number"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    total: moneyColumn("total"),
    status: text("status").notNull(),
    branchName: text("branch_name").notNull(),
    receipt: jsonb("receipt"),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.id] }),
    foreignKey({
      columns: [t.orgId, t.customerId],
      foreignColumns: [relayCustomer.orgId, relayCustomer.id],
    }).onDelete("cascade"),
  ],
);
