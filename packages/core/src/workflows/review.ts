import * as v from "valibot";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  WorkflowTimeoutError,
  type Json,
  type Workflow,
  type WorkflowCheckpoint,
} from "@shopper/ports";
import { askForReview } from "../orders/reviews/submit";
import { publishReview, screenReview } from "../orders/reviews/screen";
import type { ReviewFlowDeps } from "../orders/types";
import { orderParams } from "../schemas/orders/flow";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;
const hour = 3_600_000;

/** The workflow instance id of an order's review: the business key, kept apart from the order's own run. */
export const reviewInstanceId = (orderId: string) => `review-${orderId}`;

/**
 * One order's review (instance id = `review-<order id>`), started when the order is handed over: sleep 48 hours,
 * ask the shopper, wait seven days for their review, screen it, wait for a moderator if it was flagged, then publish.
 * Nobody answering is not an error: the run just ends.
 */
export async function runOrderReview(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor" | "sleep">,
  deps: ReviewFlowDeps,
  raw: unknown,
) {
  const params = v.parse(orderParams, raw);
  if (flow.instanceId !== reviewInstanceId(params.id))
    throw new Error("Order review business key mismatch");
  const context = {
    orgId: params.orgId,
    appVersion: deps.appVersion,
    queue: deps.notifications?.(),
  };
  const record = <T extends Json>(
    step: string,
    command: (
      db: ShopperDatabase,
      ctx: typeof context,
      input: { id: string },
      at: WorkflowCheckpoint,
    ) => Promise<T>,
  ) =>
    flow.step(step, policy, () =>
      deps.withDatabase((db) => command(db, context, { id: params.id }, checkpoint(flow, step))),
    );

  await flow.sleep("ask-after", deps.askAfterMs ?? 48 * hour);
  const asked = await record("ask", askForReview);
  // A review given before the ask (from the order page) is already in the table: screen it without waiting.
  if (
    !asked.reviewed &&
    !(await waited(flow.waitFor("review", "review_submitted", deps.waitMs ?? 7 * 24 * hour)))
  )
    return;
  const screened = await record("screen", screenReview);
  if (screened.status === "flagged") {
    // Without a decision in time the review stays hidden; the moderator can still decide later.
    if (
      !(await waited(
        flow.waitFor("moderate", "moderator_decision", deps.moderateWithinMs ?? 30 * 24 * hour),
      ))
    )
      return;
  }
  await record("publish", publishReview);
}

const waited = (wait: Promise<Json>) =>
  wait.then(
    () => true,
    (error: unknown) => {
      if (error instanceof WorkflowTimeoutError) return false;
      throw error;
    },
  );

const checkpoint = (flow: Pick<Workflow, "instanceId">, step: string): WorkflowCheckpoint => ({
  instanceId: flow.instanceId,
  businessKey: flow.instanceId,
  type: "order-review",
  step,
  status: step === "publish" ? "completed" : "waiting",
});
