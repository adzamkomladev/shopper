import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runKyb } from "@shopper/core/kyb";
import { createPaystack } from "@shopper/core/payments/paystack";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { hyperdriveDatabase } from "../database";
import { cloudflareQueue } from "../queue";
import { cloudflareBlobs } from "../storage";
import { cloudflareFlow } from "./flow";

interface KybEnvironment {
  HYPERDRIVE: Hyperdrive;
  BLOBS: R2Bucket;
  RECEIPTS: R2Bucket;
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_BASE_URL?: string;
  SHOPPER_AUTH_URL?: string;
  SHOPPER_AUTH_SECRET?: string;
}

/** Cloudflare shell for one shop's business verification and payouts (instance id = `kyb-<org>`). */
export class KybWorkflow extends WorkflowEntrypoint<KybEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    const { blobs } = await cloudflareBlobs(this.env.BLOBS, {
      receipts: this.env.RECEIPTS,
      baseUrl: this.env.SHOPPER_AUTH_URL ?? "https://shopper.invalid",
      secret: new TextEncoder().encode(this.env.SHOPPER_AUTH_SECRET ?? ""),
    });
    await runKyb(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        appVersion: buildInfo.version,
        queue: this.env.NOTIFICATIONS
          ? cloudflareQueue(this.env.NOTIFICATIONS, NOTIFICATION_RETRY)
          : undefined,
        blobs,
        paystack: createPaystack({
          secretKey: this.env.PAYSTACK_SECRET_KEY,
          baseUrl: this.env.PAYSTACK_BASE_URL,
        }),
      },
      event.payload,
    );
  }
}
