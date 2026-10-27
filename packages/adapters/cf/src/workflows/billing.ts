import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runBilling } from "@shopper/core/billing";
import { createPaystack } from "@shopper/core/payments/paystack";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { hyperdriveDatabase } from "../database";
import { cloudflareQueue } from "../queue";
import { cloudflareFlow } from "./flow";

interface BillingEnvironment {
  HYPERDRIVE: Hyperdrive;
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_BASE_URL?: string;
}

/** Cloudflare shell for one Shopper billing period: invoice, checkout link and dunning (instance id = org and period). */
export class BillingWorkflow extends WorkflowEntrypoint<BillingEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runBilling(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        appVersion: buildInfo.version,
        queue: this.env.NOTIFICATIONS
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
