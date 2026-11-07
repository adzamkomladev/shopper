import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runOnlineOrder } from "@shopper/core/orders";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { createPaystack } from "@shopper/core/payments/paystack";
import { hyperdriveDatabase } from "../database";
import { cloudflareQueue } from "../queue";
import { cloudflareFlow } from "./flow";

/** Cloudflare shell for one online order (instance id = order id). */
export class OnlineOrderWorkflow extends WorkflowEntrypoint<
  {
    HYPERDRIVE: Hyperdrive;
    NOTIFICATIONS?: Queue;
    PAYSTACK_SECRET_KEY?: string;
    PAYSTACK_BASE_URL?: string;
  },
  Json
> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runOnlineOrder(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        appVersion: buildInfo.version,
        notifications: () =>
          this.env.NOTIFICATIONS
            ? cloudflareQueue(this.env.NOTIFICATIONS, NOTIFICATION_RETRY)
            : undefined,
        paystack: this.env.PAYSTACK_SECRET_KEY
          ? createPaystack({
              secretKey: this.env.PAYSTACK_SECRET_KEY,
              baseUrl: this.env.PAYSTACK_BASE_URL,
            })
          : undefined,
      },
      event.payload,
    );
  }
}
