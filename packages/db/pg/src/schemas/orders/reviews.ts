import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenant } from "../base";
import { onlineOrder } from "./base";

export const reviewStatuses = ["submitted", "flagged", "published", "rejected"] as const;

/** A shopper's review of a completed order. Only a published review is shown on the store. */
export const orderReview = pgTable(
  "order_review",
  {
    ...tenant(),
    orderId: uuid("order_id").notNull(),
    branchId: uuid("branch_id").notNull(),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    status: text("status", { enum: reviewStatuses }).notNull().default("submitted"),
    flagReason: text("flag_reason"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.orgId, t.id),
    unique("order_review_order").on(t.orgId, t.orderId),
    foreignKey({
      columns: [t.orgId, t.orderId],
      foreignColumns: [onlineOrder.orgId, onlineOrder.id],
    }),
    check("order_review_rating", sql`${t.rating} BETWEEN 1 AND 5`),
    check(
      "order_review_status",
      sql`${t.status} IN ('submitted', 'flagged', 'published', 'rejected')`,
    ),
    check(
      "order_review_published",
      sql`(${t.status} = 'published') = (${t.publishedAt} IS NOT NULL)`,
    ),
  ],
);
