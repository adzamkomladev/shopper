import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runOrderReview } from "@shopper/core/orders";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { hyperdriveDatabase } from "../database";
import { cloudflareQueue } from "../queue";
import { cloudflareFlow } from "./flow";

/** Cloudflare shell for one order's review (instance id = `review-<order id>`). */
export class OrderReviewWorkflow extends WorkflowEntrypoint<
  { HYPERDRIVE: Hyperdrive; NOTIFICATIONS?: Queue },
  Json
> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runOrderReview(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        appVersion: buildInfo.version,
        notifications: () =>
          this.env.NOTIFICATIONS
            ? cloudflareQueue(this.env.NOTIFICATIONS, NOTIFICATION_RETRY)
            : undefined,
      },
      event.payload,
    );
  }
}
