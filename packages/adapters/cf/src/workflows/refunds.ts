import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runMomoRefund } from "@shopper/core/payments";
import { createPaystack } from "@shopper/core/payments/paystack";
import type { Json } from "@shopper/ports";
import { hyperdriveDatabase } from "../database";
import { cloudflareHubtel } from "../hubtel";
import { cloudflareFlow } from "./flow";

interface MomoRefundEnvironment {
  HYPERDRIVE: Hyperdrive;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_BASE_URL?: string;
  HUBTEL_CLIENT_ID?: string;
  HUBTEL_CLIENT_SECRET?: string;
  HUBTEL_MERCHANT_ACCOUNT?: string;
  SHOPPER_AUTH_URL?: string;
}

/** Cloudflare shell for a MoMo refund back to the customer's wallet (instance id = refund id). */
export class MomoRefundWorkflow extends WorkflowEntrypoint<MomoRefundEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runMomoRefund(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        paystack: createPaystack({
          secretKey: this.env.PAYSTACK_SECRET_KEY,
          baseUrl: this.env.PAYSTACK_BASE_URL,
        }),
        hubtel: cloudflareHubtel(this.env),
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}
