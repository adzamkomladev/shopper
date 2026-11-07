import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { orderReview } from "@shopper/db-pg";

/** What sends a review to a moderator instead of straight to the shop's page. */
const rules: [RegExp, string][] = [
  [/https?:\/\/|www\.|\b[\w-]+\.(?:com|net|org|gh|io|co)\b/i, "Contains a link"],
  [/(?:\+?233|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|\d{9,}/, "Contains a phone number"],
  [/\b(?:scam|scammers?|fraud|thieves|thief|idiots?|stupid)\b/i, "Uses a blocked word"],
];

/** Screens a submitted review: a link, a phone number or a blocked word flags it for a moderator. */
export const screenReview = defineCommand({
  name: "review.screened",
  async run(tx, ctx, input: { id: string }) {
    const [review] = await tx
      .select()
      .from(orderReview)
      .where(and(eq(orderReview.orgId, ctx.orgId), eq(orderReview.orderId, input.id)));
    if (!review) return { status: "none" as const };
    if (review.status !== "submitted") return { status: review.status };
    const reason = rules.find(([rule]) => rule.test(review.comment ?? ""))?.[1];
    if (!reason) return { status: "submitted" as const };
    await tx
      .update(orderReview)
      .set({ status: "flagged", flagReason: reason, updatedAt: new Date() })
      .where(and(eq(orderReview.orgId, ctx.orgId), eq(orderReview.id, review.id)));
    return { status: "flagged" as const };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** The last step: a review nobody flagged goes on the shop's page. A moderator's decision stands as it is. */
export const publishReview = defineCommand({
  name: "review.published",
  async run(tx, ctx, input: { id: string }) {
    const now = new Date();
    const published = await tx
      .update(orderReview)
      .set({ status: "published", publishedAt: now, updatedAt: now })
      .where(
        and(
          eq(orderReview.orgId, ctx.orgId),
          eq(orderReview.orderId, input.id),
          eq(orderReview.status, "submitted"),
        ),
      )
      .returning({ id: orderReview.id });
    return { published: published.length > 0 };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
