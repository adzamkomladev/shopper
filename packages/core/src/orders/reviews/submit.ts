import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { orderReview } from "@shopper/db-pg";
import { v7 } from "uuid";
import { reviewDecision, reviewInput } from "../../schemas/orders/review";
import { OrderError } from "../error";
import { readOrder } from "../flow";

/** How long after hand-over a review is taken: the 48 hours before the ask and the seven days the workflow waits. */
export const REVIEW_WINDOW_MS = 9 * 24 * 3_600_000;

/** Whether an order handed over at `completedAt` can still be reviewed at `now`. */
export const reviewable = (completedAt: Date | null, now = new Date()) =>
  completedAt !== null && now.getTime() - completedAt.getTime() <= REVIEW_WINDOW_MS;

/** The shopper reviews an order they have received: once, within the window, with stars and a few words. */
export const submitReview = defineCommand({
  name: "review.submitted",
  async run(tx, ctx, raw: v.InferInput<typeof reviewInput>) {
    const input = v.parse(reviewInput, raw);
    const order = await readOrder(tx, ctx.orgId, input.id);
    if (order.status !== "completed")
      throw new OrderError("conflict", "You can review an order once you have it.");
    // After the window the review's workflow has ended, so nothing would ever screen or publish a late one.
    if (!reviewable(order.completedAt))
      throw new OrderError("conflict", "The time to review this order has passed.");
    const [saved] = await tx
      .insert(orderReview)
      .values({
        orgId: ctx.orgId,
        orderId: order.id,
        branchId: order.branchId,
        authorName: order.customerName.split(" ")[0]!,
        rating: input.rating,
        comment: input.comment,
      })
      .onConflictDoNothing({ target: [orderReview.orgId, orderReview.orderId] })
      .returning({ id: orderReview.id });
    if (!saved) throw new OrderError("conflict", "You have already reviewed this order.");
    return { id: saved.id };
  },
  audit: (input, output) => ({ orderId: input.id, rating: input.rating, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});

/** A moderator publishes or rejects a flagged review. */
export const decideReview = defineCommand({
  name: "review.decided",
  async run(tx, ctx, input: { id: string; decision: v.InferInput<typeof reviewDecision> }) {
    const decision = v.parse(reviewDecision, input.decision);
    const now = new Date();
    const [decided] = await tx
      .update(orderReview)
      .set({
        status: decision === "approve" ? "published" : "rejected",
        publishedAt: decision === "approve" ? now : null,
        decidedBy: ctx.actorId ?? null,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(orderReview.orgId, ctx.orgId),
          eq(orderReview.id, input.id),
          eq(orderReview.status, "flagged"),
        ),
      )
      .returning({ orderId: orderReview.orderId, status: orderReview.status });
    if (!decided) throw new OrderError("conflict", "This review is not waiting for a decision.");
    return decided;
  },
  audit: (input, output) => ({ id: input.id, decision: input.decision, orderId: output.orderId }),
  details: (input) => ({ entity: "order_review", entityId: input.id }),
});

/** Asks the shopper for a review, once, if they have not given one: queues the text. */
export const askForReview = defineCommand({
  name: "review.asked",
  async run(tx, ctx, input: { id: string }) {
    const order = await readOrder(tx, ctx.orgId, input.id);
    const [review] = await tx
      .select({ id: orderReview.id })
      .from(orderReview)
      .where(and(eq(orderReview.orgId, ctx.orgId), eq(orderReview.orderId, order.id)));
    const asked = order.status === "completed" && !review && !order.reviewAskedAt;
    if (asked)
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: ctx.orgId,
        v: 1,
        sequence: "0",
        type: "review.ask",
        payload: { orderId: order.id },
      });
    return { asked, reviewed: Boolean(review) };
  },
  audit: (input, output) => ({ id: input.id, ...output }),
  details: (input) => ({ entity: "online_order", entityId: input.id }),
});
