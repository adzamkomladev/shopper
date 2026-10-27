import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runSettlement } from "@shopper/core/payments";
import { createPaystack } from "@shopper/core/payments/paystack";
import type { Json } from "@shopper/ports";
import { hyperdriveDatabase } from "../database";
import { cloudflareFlow } from "./flow";

interface SettlementEnvironment {
  HYPERDRIVE: Hyperdrive;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_BASE_URL?: string;
}

/** Cloudflare shell for one org's daily Paystack settlement fetch and match (instance id = org and day). */
export class SettlementWorkflow extends WorkflowEntrypoint<SettlementEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runSettlement(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        paystack: createPaystack({
          secretKey: this.env.PAYSTACK_SECRET_KEY,
          baseUrl: this.env.PAYSTACK_BASE_URL,
        }),
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}
