import { and, avg, count, desc, eq } from "drizzle-orm";
import { onlineOrder, orderReview } from "@shopper/db-pg";
import type { Queryable } from "../../types";

/** What a shop shows of its reviews: how many, the average to one decimal, and the latest few, published ones only. */
export async function listPublishedReviews(db: Queryable, orgId: string, limit = 10) {
  const published = and(eq(orderReview.orgId, orgId), eq(orderReview.status, "published"));
  const [totals] = await db
    .select({ total: count(), average: avg(orderReview.rating) })
    .from(orderReview)
    .where(published);
  const latest = await db
    .select({
      rating: orderReview.rating,
      comment: orderReview.comment,
      authorName: orderReview.authorName,
      at: orderReview.publishedAt,
    })
    .from(orderReview)
    .where(published)
    .orderBy(desc(orderReview.publishedAt))
    .limit(limit);
  return {
    count: totals!.total,
    average: totals!.average === null ? null : Math.round(Number(totals!.average) * 10) / 10,
    latest: latest.map((review) => ({ ...review, at: review.at!.toISOString() })),
  };
}

/** The reviews waiting for a moderator, oldest first, with the order they are about. */
export async function listFlaggedReviews(db: Queryable, orgId: string) {
  const rows = await db
    .select({
      id: orderReview.id,
      orderId: orderReview.orderId,
      number: onlineOrder.inboxCursor,
      rating: orderReview.rating,
      comment: orderReview.comment,
      authorName: orderReview.authorName,
      flagReason: orderReview.flagReason,
      at: orderReview.createdAt,
    })
    .from(orderReview)
    .innerJoin(
      onlineOrder,
      and(eq(onlineOrder.orgId, orderReview.orgId), eq(onlineOrder.id, orderReview.orderId)),
    )
    .where(and(eq(orderReview.orgId, orgId), eq(orderReview.status, "flagged")))
    .orderBy(orderReview.createdAt);
  return rows.map((row) => ({ ...row, number: Number(row.number), at: row.at.toISOString() }));
}
