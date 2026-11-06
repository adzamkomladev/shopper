import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runOnlineOrder } from "@shopper/core/orders";
import type { Json } from "@shopper/ports";
import { hyperdriveDatabase } from "../database";
import { cloudflareFlow } from "./flow";

/** Cloudflare shell for one online order (instance id = order id). */
export class OnlineOrderWorkflow extends WorkflowEntrypoint<{ HYPERDRIVE: Hyperdrive }, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runOnlineOrder(
      cloudflareFlow(event, step),
      { withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE), appVersion: buildInfo.version },
      event.payload,
    );
  }
}
